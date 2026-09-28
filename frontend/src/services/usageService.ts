import api from '@/api';
import type { UsageView } from '@/types/usage';

export async function getUsage(): Promise<UsageView> {
  // Sondado a cada minuto: uma falha pontual não merece um toast — o indicador mostra o último valor.
  return (await api.get<UsageView>('/usage', { skipErrorNotification: true })).data;
}
