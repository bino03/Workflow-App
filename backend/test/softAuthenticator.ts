import { createHash, generateKeyPairSync, randomBytes, sign } from 'node:crypto';
import { isoCBOR } from '@simplewebauthn/server/helpers';
import { TEST_ORIGIN } from './helpers.js';

const UP = 0x01;
const UV = 0x04;
const AT = 0x40;

const b64url = (bytes: Uint8Array | string) => Buffer.from(bytes).toString('base64url');
const sha256 = (data: Uint8Array | string) => createHash('sha256').update(data).digest();

export type CeremonyOverrides = {
  origin?: string;
  rpId?: string;
  /** Sign with a different key than the one registered. */
  forgeSignature?: boolean;
  userVerified?: boolean;
};

/**
 * A software WebAuthn authenticator (ES256, attestation "none") — enough to drive the real
 * @simplewebauthn/server verification end to end, without a browser.
 */
export class SoftAuthenticator {
  readonly credentialId = randomBytes(16);
  private readonly keys = generateKeyPairSync('ec', { namedCurve: 'P-256' });
  private counter = 0;

  constructor(private readonly rpId = 'localhost') {}

  get id(): string {
    return b64url(this.credentialId);
  }

  register({ challenge }: { challenge: string }, overrides: CeremonyOverrides = {}) {
    const jwk = this.keys.publicKey.export({ format: 'jwk' });
    const coseKey = isoCBOR.encode(
      new Map<number, number | Uint8Array>([
        [1, 2], // kty: EC2
        [3, -7], // alg: ES256
        [-1, 1], // crv: P-256
        [-2, Buffer.from(jwk.x!, 'base64url')],
        [-3, Buffer.from(jwk.y!, 'base64url')],
      ]),
    );
    const idLength = Buffer.alloc(2);
    idLength.writeUInt16BE(this.credentialId.length);
    const authData = Buffer.concat([
      this.header(overrides, AT),
      Buffer.alloc(16), // aaguid
      idLength,
      this.credentialId,
      coseKey,
    ]);
    const attestationObject = isoCBOR.encode(
      new Map<string, string | Map<number, number> | Uint8Array>([
        ['fmt', 'none'],
        ['attStmt', new Map<number, number>()],
        ['authData', authData],
      ]),
    );
    return {
      id: this.id,
      rawId: this.id,
      type: 'public-key' as const,
      clientExtensionResults: {},
      response: {
        clientDataJSON: this.clientData('webauthn.create', challenge, overrides),
        attestationObject: b64url(attestationObject),
        transports: ['internal'],
      },
    };
  }

  authenticate({ challenge }: { challenge: string }, overrides: CeremonyOverrides = {}) {
    this.counter += 1;
    const authData = this.header(overrides, 0);
    const clientDataJSON = this.clientData('webauthn.get', challenge, overrides);
    const signedBy = overrides.forgeSignature
      ? generateKeyPairSync('ec', { namedCurve: 'P-256' }).privateKey
      : this.keys.privateKey;
    const signature = sign('sha256', Buffer.concat([authData, sha256(Buffer.from(clientDataJSON, 'base64url'))]), signedBy);
    return {
      id: this.id,
      rawId: this.id,
      type: 'public-key' as const,
      clientExtensionResults: {},
      response: {
        clientDataJSON,
        authenticatorData: b64url(authData),
        signature: b64url(signature),
      },
    };
  }

  private header(overrides: CeremonyOverrides, extraFlags: number): Buffer {
    const flags = UP | (overrides.userVerified === false ? 0 : UV) | extraFlags;
    const counter = Buffer.alloc(4);
    counter.writeUInt32BE(this.counter);
    return Buffer.concat([sha256(overrides.rpId ?? this.rpId), Buffer.from([flags]), counter]);
  }

  private clientData(type: string, challenge: string, overrides: CeremonyOverrides): string {
    return b64url(JSON.stringify({ type, challenge, origin: overrides.origin ?? TEST_ORIGIN, crossOrigin: false }));
  }
}
