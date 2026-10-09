import type { AuthenticationResponseJSON } from '@simplewebauthn/browser';
import { createContext } from 'react';
import type { LoginCredentials } from '@/types/auth';

export type AuthStatus = 'checking' | 'authenticated' | 'anonymous';

export type AuthContextValue = {
  status: AuthStatus;
  login: (credentials: LoginCredentials) => Promise<void>;
  /** O segundo caminho de entrada (ADR 0015): a resposta do navigator.credentials.get(). */
  loginWithPasskey: (response: AuthenticationResponseJSON) => Promise<void>;
  logout: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | null>(null);
