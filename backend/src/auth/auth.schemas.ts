import { z } from 'zod';

export const loginSchema = z.object({
  username: z.string().trim().min(1).max(64),
  password: z.string().min(1).max(1024),
});

const base64url = z.string().min(1).max(16_384).regex(/^[A-Za-z0-9_-]*$/, 'must be base64url');

/** What @simplewebauthn/browser's startAuthentication() returns; the signature is checked by the library. */
export const authenticationResponseSchema = z.object({
  id: base64url,
  rawId: base64url,
  type: z.literal('public-key'),
  authenticatorAttachment: z.enum(['platform', 'cross-platform']).optional(),
  clientExtensionResults: z.record(z.string(), z.unknown()),
  response: z.object({
    clientDataJSON: base64url,
    authenticatorData: base64url,
    signature: base64url,
    userHandle: base64url.optional(),
  }),
});

/** What @simplewebauthn/browser's startRegistration() returns. */
export const registrationResponseSchema = z.object({
  id: base64url,
  rawId: base64url,
  type: z.literal('public-key'),
  authenticatorAttachment: z.enum(['platform', 'cross-platform']).optional(),
  clientExtensionResults: z.record(z.string(), z.unknown()),
  response: z.object({
    clientDataJSON: base64url,
    attestationObject: base64url,
    authenticatorData: base64url.optional(),
    transports: z.array(z.string().max(32)).max(10).optional(),
    publicKeyAlgorithm: z.number().int().optional(),
    publicKey: base64url.optional(),
  }),
});

export const passkeyLoginSchema = z.object({ response: authenticationResponseSchema });

export const passkeyRegistrationOptionsSchema = z.object({ password: z.string().min(1).max(1024) });

export const passkeyRegistrationSchema = z.object({
  name: z.string().trim().min(1).max(64),
  response: registrationResponseSchema,
});

export const passkeyIdParamsSchema = z.object({ id: base64url.max(2048) });
