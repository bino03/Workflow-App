import { useCallback } from 'react';
import { useNavigate } from 'react-router';
import { STATUS_EFFECT, STATUS_TAG } from '@/components/upwork/upworkFormat';
import { ErrorHandler } from '@/errors/errorHandler';
import { useConfirm } from '@/hooks/useConfirm';
import { notificationService } from '@/services/general/notificationService';
import { createTerminal } from '@/services/terminalService';
import { archiveApplication, deleteApplication, updateApplication } from '@/services/upworkService';
import type { ApplicationStatus, ApplicationView } from '@/types/upwork';

/** O terminal de "Abrir projeto" nasce com este tamanho; a grelha ajusta-o ao aparecer. */
const TERMINAL_SIZE = { cols: 120, rows: 40 };

/** Corre uma ação e diz se correu bem; o detalhe passa o seu (desativa o cabeçalho e relê a sessão). */
type Run = (action: () => Promise<unknown>) => Promise<boolean>;

const runAndReport: Run = async (action) => {
  try {
    await action();
    return true;
  } catch (e) {
    ErrorHandler.handle(e);
    return false;
  }
};

type ApplicationActionsOptions = {
  onChanged: (application: ApplicationView) => void;
  /** Arquivada (sai da lista aberta) ou apagada. */
  onRemoved: (id: string) => void;
  run?: Run;
};

/**
 * O que se faz a uma candidatura, igual no menu de contexto da lista e no cabeçalho do detalhe: mudar o estado,
 * arquivar e apagar (sempre com confirmação), abrir o projeto, copiar a carta.
 */
export function useApplicationActions({ onChanged, onRemoved, run = runAndReport }: ApplicationActionsOptions) {
  const navigate = useNavigate();
  const confirm = useConfirm();

  const changeStatus = useCallback(
    (application: ApplicationView, status: ApplicationStatus) =>
      confirm({
        title: `Marcar como ${STATUS_TAG[status].label}?`,
        actionLabel: 'Marcar',
        danger: false,
        message: STATUS_EFFECT[status],
        onConfirm: async () => {
          await run(async () => onChanged(await updateApplication(application.id, { status })));
        },
      }),
    [confirm, run, onChanged],
  );

  const archive = useCallback(
    (application: ApplicationView) =>
      confirm({
        title: 'Arquivar esta candidatura?',
        actionLabel: 'Arquivar',
        danger: false,
        message: 'O pacote fica guardado; a conversa com o Claude é apagada e já não dá para continuar. Sai da lista (filtro Arquivadas).',
        onConfirm: async () => {
          if (await run(async () => onChanged(await archiveApplication(application.id)))) onRemoved(application.id);
        },
      }),
    [confirm, run, onChanged, onRemoved],
  );

  const remove = useCallback(
    (application: ApplicationView) =>
      confirm({
        title: 'Apagar esta candidatura?',
        actionLabel: 'Apagar',
        message: 'O registo e o pacote guardado desaparecem. Não dá para desfazer.',
        onConfirm: async () => {
          if (await run(() => deleteApplication(application.id))) onRemoved(application.id);
        },
      }),
    [confirm, run, onRemoved],
  );

  const openProject = useCallback(
    (projectPath: string) =>
      void run(async () => {
        const terminal = await createTerminal({ cwd: projectPath, mode: 'new', ...TERMINAL_SIZE });
        void navigate('/terminals', { state: { focusTerminalId: terminal.id } });
      }),
    [run, navigate],
  );

  /** Do menu não há botão que mostre "Copiado": a confirmação é uma notificação. */
  const copyLetter = useCallback(async (letter: string) => {
    try {
      await navigator.clipboard.writeText(letter);
      notificationService.success('Carta copiada');
    } catch {
      // Fora de um contexto seguro (http num IP da rede) o browser não expõe a área de transferência.
      notificationService.error('Erro', 'Não foi possível copiar.');
    }
  }, []);

  return { changeStatus, archive, remove, openProject, copyLetter };
}
