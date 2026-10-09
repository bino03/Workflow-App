/** Corpo de POST /api/auth/login (ADR 0011). */
export type LoginCredentials = { username: string; password: string };

/** Uma passkey registada (GET /api/auth/passkeys, ADR 0015). A chave pública nunca sai do backend. */
export type PasskeySummary = {
  id: string;
  name: string;
  deviceType: 'singleDevice' | 'multiDevice';
  backedUp: boolean;
  createdAt: string;
  lastUsedAt: string | null;
  /** A sessão deste browser foi aberta com esta passkey — revogá-la termina-a. */
  current: boolean;
};
