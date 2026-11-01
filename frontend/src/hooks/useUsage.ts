import { use } from 'react';
import { UsageContext } from '@/contexts/usageContextValue';

/** A quota da subscrição, da sondagem partilhada do `<UsageProvider>` (no `AppLayout`). */
export function useUsage() {
  const value = use(UsageContext);
  if (!value) throw new Error('useUsage fora do <UsageProvider>');
  return value;
}
