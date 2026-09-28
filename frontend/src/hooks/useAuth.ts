import { use } from 'react';
import { AuthContext } from '@/contexts/authContextValue';

export function useAuth() {
  const value = use(AuthContext);
  if (!value) throw new Error('useAuth fora do <AuthProvider>');
  return value;
}
