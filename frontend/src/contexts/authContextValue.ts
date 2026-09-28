import { createContext } from 'react';
import type { LoginCredentials } from '@/types/auth';

export type AuthStatus = 'checking' | 'authenticated' | 'anonymous';

export type AuthContextValue = {
  status: AuthStatus;
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | null>(null);
