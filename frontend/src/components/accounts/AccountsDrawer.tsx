import { PlusOutlined } from '@ant-design/icons';
import { Button, Drawer, Spin } from 'antd';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { DRAWER_WIDTH } from '@/config/drawer';
import { ErrorHandler } from '@/errors/errorHandler';
import { useAccounts } from '@/hooks/useAccounts';
import { useConfirm } from '@/hooks/useConfirm';
import { useUsage } from '@/hooks/useUsage';
import { createAccount, openAccountLogin, removeAccount, renameAccount } from '@/services/accountService';
import { MAX_ACCOUNTS, type AccountView } from '@/types/account';
import { AccountNameForm } from './AccountNameForm';
import { AccountQuota } from './AccountQuota';

type AccountsDrawerProps = { open: boolean; onClose: () => void };

// O xterm.js acerta o tamanho ao ligar-se; isto é só o arranque do `claude`.
const LOGIN_TERMINAL_SIZE = { cols: 120, rows: 40 };

/**
 * Drawer "Escolher conta" (Small, 540; ADR 0027): a conta ativa, a quota de cada conta, e adicionar, renomear e
 * remover contas. O login de uma conta faz-se uma vez, no terminal que a app abre para isso.
 */
export function AccountsDrawer({ open, onClose }: AccountsDrawerProps) {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const { now } = useUsage();
  const { view, refresh, setActive } = useAccounts();
  const [adding, setAdding] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const close = () => {
    setAdding(false);
    setRenamingId(null);
    onClose();
  };

  const reload = () => refresh().catch((e: unknown) => ErrorHandler.handle(e));

  const openLogin = async (account: Pick<AccountView, 'id' | 'label'>) => {
    setBusyId(account.id);
    try {
      const terminal = await openAccountLogin(account.id, LOGIN_TERMINAL_SIZE);
      close();
      void navigate('/terminals', { state: { focusTerminalId: terminal.id, loginAccountLabel: account.label } });
    } catch (e) {
      // Na adição, a conta já existe: fica na lista com "Iniciar sessão" para tentar outra vez.
      ErrorHandler.handle(e);
    } finally {
      setBusyId(null);
    }
  };

  const add = async (label: string) => {
    const account = await createAccount(label);
    setAdding(false);
    void reload();
    await openLogin(account);
  };

  const rename = async (id: string, label: string) => {
    await renameAccount(id, label);
    setRenamingId(null);
    await reload();
  };

  const choose = async (id: string) => {
    setBusyId(id);
    try {
      await setActive(id);
    } catch (e) {
      ErrorHandler.handle(e);
    } finally {
      setBusyId(null);
    }
  };

  const remove = (account: AccountView) =>
    confirm({
      title: `Remover ${account.label}?`,
      actionLabel: 'Remover conta',
      message:
        'Apaga a pasta e o login desta conta. As conversas e as skills ficam, e os terminais parados dela passam para a principal. Para a voltar a usar, é preciso fazer o login outra vez.',
      onConfirm: async () => {
        try {
          await removeAccount(account.id);
        } catch (e) {
          ErrorHandler.handle(e);
        }
        await reload();
      },
    });

  const accounts = view?.accounts ?? [];
  const atLimit = accounts.length >= MAX_ACCOUNTS;

  return (
    <Drawer
      open={open}
      onClose={close}
      afterOpenChange={(isOpen) => {
        if (isOpen) void reload();
      }}
      size={DRAWER_WIDTH.small}
      extra={<span className="kbd">Esc</span>}
      title={
        <div className="flex flex-col gap-1">
          <h6 className="kicker m-0">Contas do Claude</h6>
          <h2 className="m-0 text-[20px] leading-[26px] font-semibold text-text-1">Escolher conta</h2>
        </div>
      }
      footer={
        <div className="flex items-center gap-2">
          <span className="text-[12px] text-text-3">O que criares a seguir usa a conta ativa. Os terminais abertos não mudam.</span>
          <span className="flex-1" />
          <Button type="primary" onClick={close}>
            Fechar
          </Button>
        </div>
      }
    >
      {view === null ? (
        <Spin size="small" />
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2" role="radiogroup" aria-label="Conta ativa">
            {accounts.map((account) => {
              const selected = account.id === view.activeAccountId;
              return (
                <div
                  key={account.id}
                  data-account-id={account.id}
                  className={`flex flex-col gap-2.5 p-3 rounded-md border ${selected ? 'border-accent-border bg-accent-subtle' : 'border-border'}`}
                >
                  <button
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    disabled={busyId !== null}
                    onClick={() => void choose(account.id)}
                    className="w-full text-left flex items-center gap-3 p-0 border-0 bg-transparent cursor-pointer"
                  >
                    <span
                      className={`w-4 h-4 rounded-full flex-none flex items-center justify-center border-[1.5px] ${selected ? 'border-accent' : 'border-border-strong'}`}
                      aria-hidden
                    >
                      <span className={`w-2 h-2 rounded-full ${selected ? 'bg-accent' : ''}`} />
                    </span>
                    <span className="flex flex-col gap-px min-w-0">
                      <span className="text-[13.5px] font-medium text-text-1 truncate">{account.label}</span>
                      <span className={`text-[12.5px] truncate ${account.loggedIn ? 'text-text-3' : 'text-warning'}`}>
                        {account.loggedIn ? (account.email ?? 'Sessão iniciada') : 'Sem sessão iniciada'}
                      </span>
                    </span>
                  </button>

                  <AccountQuota usage={account.usage} now={now} />

                  {renamingId === account.id ? (
                    <AccountNameForm
                      initialLabel={account.label}
                      submitLabel="Guardar"
                      onSubmit={(label) => rename(account.id, label)}
                      onCancel={() => setRenamingId(null)}
                    />
                  ) : (
                    <div className="flex items-center gap-1">
                      <span className="text-[12px] text-text-3">
                        {account.runningTerminals === 1 ? '1 terminal a correr' : `${account.runningTerminals} terminais a correr`}
                      </span>
                      <span className="flex-1" />
                      {!account.loggedIn && (
                        <Button type="text" size="small" loading={busyId === account.id} onClick={() => void openLogin(account)}>
                          Iniciar sessão
                        </Button>
                      )}
                      <Button type="text" size="small" onClick={() => setRenamingId(account.id)}>
                        Renomear
                      </Button>
                      {!account.isPrimary && (
                        <Button type="text" size="small" danger onClick={() => remove(account)}>
                          Remover
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {adding ? (
            <AccountNameForm
              submitLabel="Adicionar"
              hint="A seguir abre um terminal para o login."
              onSubmit={add}
              onCancel={() => setAdding(false)}
            />
          ) : (
            <div className="flex items-center gap-2">
              <Button icon={<PlusOutlined />} disabled={atLimit} onClick={() => setAdding(true)}>
                Adicionar conta
              </Button>
              {atLimit && <span className="text-[12px] text-text-3">Já tens {MAX_ACCOUNTS} contas.</span>}
            </div>
          )}
        </div>
      )}
    </Drawer>
  );
}
