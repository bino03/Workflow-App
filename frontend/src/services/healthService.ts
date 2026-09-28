import api from '@/api';

export async function getHealth(): Promise<boolean> {
  const { data } = await api.get<{ status: string }>('/health', { skipErrorNotification: true });
  return data.status === 'ok';
}
