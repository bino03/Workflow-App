import { createHash } from 'node:crypto';
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server';
import { isoBase64URL } from '@simplewebauthn/server/helpers';
import type { FastifyInstance, onRequestHookHandler } from 'fastify';
import type { Config } from '../config.js';
import { AppError } from '../common/errors.js';
import { parseWith } from '../common/validation.js';
import type { StartSession } from './auth.routes.js';
import {
  passkeyIdParamsSchema,
  passkeyLoginSchema,
  passkeyRegistrationOptionsSchema,
  passkeyRegistrationSchema,
} from './auth.schemas.js';
import { verifyPassword } from './authService.js';
import type { ChallengeStore } from './challengeStore.js';
import { MAX_PASSKEYS, type PasskeyStore, type StoredPasskey } from './passkeyStore.js';
import type { SessionStore } from './sessionStore.js';

/** The options route proves nothing — it only hands out a challenge — so it gets its own, looser limit. */
export const PASSKEY_OPTIONS_RATE_LIMIT = { max: 30, timeWindow: '1 minute' } as const;

/** Owner of login challenges: no session exists yet, the signed clientDataJSON carries the challenge. */
const LOGIN_OWNER = 'login';

export type PasskeyRoutesOptions = {
  config: Config;
  sessionStore: SessionStore;
  passkeyStore: PasskeyStore;
  challenges: ChallengeStore;
  identityAttempts: onRequestHookHandler;
  startSession: StartSession;
};

export type PasskeySummary = Pick<StoredPasskey, 'id' | 'name' | 'deviceType' | 'backedUp' | 'createdAt' | 'lastUsedAt'> & {
  /** This request's session was opened with this passkey — revoking it logs this browser out. */
  current: boolean;
};

function toSummary(passkey: StoredPasskey, currentPasskeyId: string | null): PasskeySummary {
  const { id, name, deviceType, backedUp, createdAt, lastUsedAt } = passkey;
  return { id, name, deviceType, backedUp, createdAt, lastUsedAt, current: id === currentPasskeyId };
}

/** Passkeys (WebAuthn) as a second, independent way in (ADR 0015). Routes under /api/auth/passkeys. */
export async function passkeyRoutes(
  app: FastifyInstance,
  { config, sessionStore, passkeyStore, challenges, identityAttempts, startSession }: PasskeyRoutesOptions,
): Promise<void> {
  const { rpId, rpName, origins } = config.webauthn;
  // Stable per user, so registering again on the same authenticator replaces its passkey instead of adding one.
  const userID = createHash('sha256').update(`workflow-app:${config.auth.username}`, 'utf8').digest();

  app.post(
    '/api/auth/passkeys/login/options',
    { config: { public: true, rateLimit: PASSKEY_OPTIONS_RATE_LIMIT } },
    async () => {
      // Discoverable passkeys: no allowCredentials, the authenticator offers what it has for this rpID.
      const options = await generateAuthenticationOptions({ rpID: rpId, userVerification: 'required' });
      challenges.remember(options.challenge, LOGIN_OWNER);
      return options;
    },
  );

  app.post('/api/auth/passkeys/login', { config: { public: true }, onRequest: identityAttempts }, async (request, reply) => {
    const { response } = parseWith(passkeyLoginSchema, request.body);
    // Unknown passkey, bad signature, expired or replayed challenge: the same AUTH_005, never saying which.
    const passkey = passkeyStore.find(response.id);
    if (!passkey) throw new AppError('AUTH_005');

    let verification;
    try {
      verification = await verifyAuthenticationResponse({
        response,
        expectedChallenge: (challenge) => challenges.consume(challenge, LOGIN_OWNER),
        expectedOrigin: origins,
        expectedRPID: rpId,
        requireUserVerification: true,
        credential: {
          id: passkey.id,
          publicKey: isoBase64URL.toBuffer(passkey.publicKey),
          counter: passkey.counter,
          transports: passkey.transports,
        },
      });
    } catch (error) {
      request.log.info({ reason: (error as Error).message }, 'passkey login refused');
      throw new AppError('AUTH_005');
    }
    if (!verification.verified) throw new AppError('AUTH_005');

    await passkeyStore.recordUse(passkey.id, verification.authenticationInfo.newCounter, new Date().toISOString());
    return startSession(request, reply, passkey.id);
  });

  app.post('/api/auth/passkeys/registration/options', { onRequest: identityAttempts }, async (request) => {
    const session = request.session!;
    const { password } = parseWith(passkeyRegistrationOptionsSchema, request.body);
    // A stolen session alone must not be enough to plant a passkey (ADR 0015).
    if (!(await verifyPassword(config.auth.passwordHash, password))) throw new AppError('AUTH_006');
    if (passkeyStore.count >= MAX_PASSKEYS) throw new AppError('AUTH_007');

    const options = await generateRegistrationOptions({
      rpName,
      rpID: rpId,
      userName: config.auth.username,
      userID,
      attestationType: 'none',
      authenticatorSelection: { residentKey: 'required', userVerification: 'required' },
      excludeCredentials: passkeyStore.list().map(({ id, transports }) => ({ id, transports })),
    });
    challenges.remember(options.challenge, session.id);
    return options;
  });

  app.post('/api/auth/passkeys', async (request, reply) => {
    const session = request.session!;
    const { name, response } = parseWith(passkeyRegistrationSchema, request.body);
    if (passkeyStore.count >= MAX_PASSKEYS) throw new AppError('AUTH_007');

    let verification;
    try {
      verification = await verifyRegistrationResponse({
        response,
        expectedChallenge: (challenge) => challenges.consume(challenge, session.id),
        expectedOrigin: origins,
        expectedRPID: rpId,
        requireUserVerification: true,
      });
    } catch (error) {
      request.log.info({ reason: (error as Error).message }, 'passkey registration refused');
      throw new AppError('AUTH_008');
    }
    if (!verification.verified) throw new AppError('AUTH_008');

    const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;
    if (passkeyStore.find(credential.id)) throw new AppError('AUTH_008', 'Passkey already registered');

    const passkey: StoredPasskey = {
      id: credential.id,
      publicKey: isoBase64URL.fromBuffer(credential.publicKey),
      counter: credential.counter,
      transports: credential.transports ?? [],
      name,
      deviceType: credentialDeviceType,
      backedUp: credentialBackedUp,
      createdAt: new Date().toISOString(),
      lastUsedAt: null,
    };
    await passkeyStore.add(passkey);
    request.log.info('passkey registered');
    return reply.status(201).send(toSummary(passkey, session.passkeyId));
  });

  app.get('/api/auth/passkeys', async (request) => ({
    passkeys: passkeyStore.list().map((passkey) => toSummary(passkey, request.session!.passkeyId)),
  }));

  app.delete('/api/auth/passkeys/:id', async (request, reply) => {
    const { id } = parseWith(passkeyIdParamsSchema, request.params);
    if (!(await passkeyStore.remove(id))) throw new AppError('AUTH_009');
    // A lost iPhone: its session ends now, not at SESSION_MAX_DAYS.
    const ended = sessionStore.destroyByPasskey(id);
    request.log.info({ endedSessions: ended }, 'passkey revoked');
    return reply.status(204).send();
  });
}
