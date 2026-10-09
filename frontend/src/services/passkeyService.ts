import type {
  AuthenticationResponseJSON,
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationResponseJSON,
} from '@simplewebauthn/browser';
import api from '@/api';
import type { PasskeySummary } from '@/types/auth';

// Passkeys (ADR 0015). As chamadas do login mostram o erro no próprio formulário, como a password.

export async function getLoginOptions(): Promise<PublicKeyCredentialRequestOptionsJSON> {
  const { data } = await api.post<PublicKeyCredentialRequestOptionsJSON>('/auth/passkeys/login/options', undefined, {
    skipErrorNotification: true,
    skipAuthRedirect: true,
  });
  return data;
}

export async function loginWithPasskey(response: AuthenticationResponseJSON): Promise<void> {
  await api.post('/auth/passkeys/login', { response }, { skipErrorNotification: true, skipAuthRedirect: true });
}

export async function getRegistrationOptions(password: string): Promise<PublicKeyCredentialCreationOptionsJSON> {
  const { data } = await api.post<PublicKeyCredentialCreationOptionsJSON>('/auth/passkeys/registration/options', { password });
  return data;
}

export async function registerPasskey(name: string, response: RegistrationResponseJSON): Promise<PasskeySummary> {
  const { data } = await api.post<PasskeySummary>('/auth/passkeys', { name, response });
  return data;
}

export async function listPasskeys(): Promise<PasskeySummary[]> {
  const { data } = await api.get<{ passkeys: PasskeySummary[] }>('/auth/passkeys');
  return data.passkeys;
}

export async function revokePasskey(id: string): Promise<void> {
  await api.delete(`/auth/passkeys/${encodeURIComponent(id)}`);
}
