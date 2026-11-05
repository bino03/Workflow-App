import { useEffect, useState } from 'react';
import { Button, Modal } from 'antd';
import { TerminalView } from '@/components/terminals/TerminalView';
import { ErrorHandler } from '@/errors/errorHandler';
import { useAccounts } from '@/hooks/useAccounts';
import { useConfirm } from '@/hooks/useConfirm';
import { notificationService } from '@/services/general/notificationService';
import { closeTerminal } from '@/services/terminalService';

export type AccountLogin = { terminalId: string; accountId: string; accountLabel: string };

// O login escreve na pasta da conta sem a app saber: é isto que faz o "Concluir" acordar sozinho.
const LOGIN_POLL_MS = 3000;

/**
 * O login de uma conta (ADR 0027): o terminal escondido, numa janela por cima da página. Não é um projeto, por isso
 * não passa pelos separadores nem pela lateral. Só o Concluir ou o Cancelar a fecham: o Esc pertence aos diálogos do
 * `claude`. Fica abaixo do diálogo de confirmação (zIndex), que pode ter sido criado antes dela na página.
 */
export function AccountLoginModal({ login, onClose }: { login: AccountLogin | null; onClose: () => void }) {
  const { view, refresh } = useAccounts();
  const confirm = useConfirm();
  const [ready, setReady] = useState(false);
  const [ended, setEnded] = useState(false);
  const [closing, setClosing] = useState(false);
  const account = view?.accounts.find((candidate) => candidate.id === login?.accountId);
  const loggedIn = account?.loggedIn ?? false;
  const terminalId = login?.terminalId;

  useEffect(() => {
    if (!terminalId) return;
    const timer = window.setInterval(() => {
      refresh().catch((e: unknown) => ErrorHandler.handle(e, { showNotification: false }));
    }, LOGIN_POLL_MS);
    return () => window.clearInterval(timer);
  }, [terminalId, refresh]);

  const finish = async () => {
    if (!terminalId) return;
    setClosing(true);
    try {
      await closeTerminal(terminalId);
      if (loggedIn) notificationService.success('Conta pronta', `${login?.accountLabel}: não vais precisar de fazer login outra vez.`);
      onClose();
    } catch (e) {
      ErrorHandler.handle(e);
    } finally {
      setClosing(false);
    }
  };

  const cancel = () => {
    if (loggedIn) {
      void finish();
      return;
    }
    confirm({
      title: 'Fechar sem fazer o login?',
      actionLabel: 'Fechar',
      danger: false,
      message: 'A conta fica na lista, sem sessão iniciada. Podes fazer o login mais tarde em "Escolher conta".',
      onConfirm: finish,
    });
  };

  const status = loggedIn
    ? `Sessão iniciada${account?.email ? ` como ${account.email}` : ''}. Responde aos diálogos que faltarem e conclui.`
    : ended
      ? 'O terminal terminou sem login. Fecha esta janela e tenta outra vez em "Escolher conta".'
      : 'À espera do login…';

  return (
    <Modal
      open={login !== null}
      width="min(1000px, 94vw)"
      zIndex={900}
      destroyOnHidden
      keyboard={false}
      mask={{ closable: false }}
      onCancel={cancel}
      afterOpenChange={(open) => {
        setReady(open);
        if (!open) setEnded(false);
      }}
      title={`Iniciar sessão — ${login?.accountLabel ?? ''}`}
      footer={
        <div className="flex items-center gap-3 text-left">
          <span className="flex-1 min-w-0 text-[12.5px] text-text-3" role="status" data-login-status={loggedIn ? 'done' : 'waiting'}>
            {status}
          </span>
          {!loggedIn && (
            <Button disabled={closing} onClick={cancel}>
              Cancelar
            </Button>
          )}
          <Button type="primary" disabled={!loggedIn} loading={closing} onClick={() => void finish()}>
            Concluir
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-3" data-account-login>
        <p className="m-0 text-[13.5px] text-text-2">
          Faz o login no browser com esta conta; é só desta vez. Depois, responde aqui aos diálogos de primeira vez da conta.
        </p>
        {/* Os atalhos da app ouvem na janela: sem isto, Alt+W fechava um terminal da página por trás. */}
        <div className="h-[60vh] rounded-md overflow-hidden border border-border bg-bg" onKeyDown={(event) => event.stopPropagation()}>
          {ready && terminalId && (
            <TerminalView terminalId={terminalId} visible focused autoFocus onExit={() => setEnded(true)} onGone={() => setEnded(true)} />
          )}
        </div>
      </div>
    </Modal>
  );
}
