import { useAccounts } from '@/hooks/useAccounts';
import { accountLabelOf } from './accountLabel';

/** O selo com a conta de um terminal. Com uma só conta não aparece: não há nada a distinguir. */
export function AccountTag({ accountId, className = '' }: { accountId: string; className?: string }) {
  const { view } = useAccounts();
  if (!view || view.accounts.length < 2) return null;
  const label = accountLabelOf(view, accountId);
  return (
    <span className={`tag min-w-0 ${className}`} title={`Conta do Claude: ${label}`} data-account-tag={accountId}>
      <span className="truncate">{label}</span>
    </span>
  );
}
