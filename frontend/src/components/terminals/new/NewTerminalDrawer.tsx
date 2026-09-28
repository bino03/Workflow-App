import { useCallback, useEffect, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Alert, Button, Drawer, Input, Space } from 'antd';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { FieldError } from '@/components/common/FieldError';
import { DRAWER_WIDTH } from '@/config/drawer';
import { ErrorHandler } from '@/errors/errorHandler';
import { getFolders } from '@/services/folderService';
import { getSessions } from '@/services/sessionService';
import type { FolderList } from '@/types/folder';
import type { SavedSession } from '@/types/session';
import type { CreateTerminalBody } from '@/types/terminal';
import { folderName, formatSessionDate } from '../terminalDisplay';
import { FolderPicker } from './FolderPicker';
import { newTerminalFormSchema, type NewTerminalFormValues } from './newTerminalFormSchema';
import { SessionPicker } from './SessionPicker';

type NewTerminalDrawerProps = {
  open: boolean;
  onClose: () => void;
  /** Cria o terminal (a página junta o tamanho). Lança o erro para ser mostrado aqui. */
  onCreate: (body: Omit<CreateTerminalBody, 'cols' | 'rows'>) => Promise<void>;
  /** Abre já nesta pasta (ex. "Retomar…" num projeto da lateral). */
  initialFolder?: string;
  /** Modo inicial — "Retomar…" abre em "Retomar uma sessão gravada". */
  initialMode?: 'new' | 'resume';
};

const EMPTY: NewTerminalFormValues = { cwd: '', mode: 'new', sessionId: undefined, label: '' };

/** Drawer Novo terminal (protótipo 1j, Small 540): pasta, sessão, nome. */
export function NewTerminalDrawer({ open, onClose, onCreate, initialFolder, initialMode = 'new' }: NewTerminalDrawerProps) {
  const [folders, setFolders] = useState<FolderList | null>(null);
  const [sessions, setSessions] = useState<SavedSession[] | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const form = useForm<NewTerminalFormValues>({
    resolver: zodResolver(newTerminalFormSchema),
    defaultValues: { ...EMPTY, cwd: initialFolder ?? '', mode: initialMode },
  });
  const { control, handleSubmit, setValue, formState } = form;
  const [cwd, mode, sessionId] = useWatch({ control, name: ['cwd', 'mode', 'sessionId'] });

  /** Depois de uma estrela mudar: relê as favoritas e as recentes. */
  const reloadFolders = useCallback(() => {
    getFolders()
      .then(setFolders)
      .catch((e: unknown) => ErrorHandler.handle(e));
  }, []);

  // A página remonta o drawer a cada abertura (key), por isso o formulário começa sempre limpo. A pasta
  // por omissão é a favorita/recente mais usada, senão a primeira raiz.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    getFolders()
      .then((list) => {
        if (cancelled) return;
        setFolders(list);
        if (initialFolder) return;
        const first = list.favorites[0]?.path ?? list.recents[0]?.path ?? list.roots[0];
        if (first) setValue('cwd', first);
      })
      .catch((e: unknown) => ErrorHandler.handle(e));
    return () => {
      cancelled = true;
    };
  }, [open, setValue, initialFolder]);

  useEffect(() => {
    if (!open || !cwd) return;
    let cancelled = false;
    getSessions(cwd)
      .then((list) => !cancelled && setSessions(list))
      .catch((e: unknown) => {
        ErrorHandler.handle(e, { showNotification: false });
        if (!cancelled) setSessions([]);
      });
    return () => {
      cancelled = true;
      setSessions(null);
    };
  }, [open, cwd]);

  const changeFolder = (path: string) => {
    setValue('cwd', path, { shouldValidate: true });
    setValue('mode', mode === 'resume' ? 'resume' : 'new');
    setValue('sessionId', undefined);
    setSubmitError(null);
  };

  const onSubmit = async (values: NewTerminalFormValues) => {
    setSubmitError(null);
    try {
      await onCreate({
        cwd: values.cwd,
        mode: values.mode,
        ...(values.mode === 'resume' ? { sessionId: values.sessionId } : {}),
        ...(values.label ? { label: values.label } : {}),
      });
      onClose();
    } catch (e) {
      // Mostrado aqui, por cima dos botões — nunca num toast (o drawer continua aberto para corrigir).
      ErrorHandler.handle(e, { showNotification: false });
      setSubmitError(ErrorHandler.getMessage(e));
    }
  };

  const chosen = mode === 'continue' ? sessions?.[0] : mode === 'resume' ? sessions?.find((s) => s.id === sessionId) : undefined;
  const summary = !cwd
    ? ''
    : chosen
      ? `Retoma ${formatSessionDate(chosen.updatedAt)} em ${cwd}`
      : mode === 'new'
        ? `Sessão nova em ${cwd}`
        : '';

  return (
    <Drawer
      open={open}
      onClose={onClose}
      size={DRAWER_WIDTH.small}
      extra={<span className="kbd">Esc</span>}
      title={
        <div className="flex flex-col gap-1">
          <h6 className="kicker m-0">Novo terminal</h6>
          <h2 className="m-0 text-[20px] leading-[26px] font-semibold text-text-1">Abrir sessão do Claude Code</h2>
        </div>
      }
      footer={
        <div className="flex flex-col gap-2">
          {submitError && <Alert type="error" showIcon title={submitError} />}
          <div className="flex items-center gap-2">
            <span className="text-[12px] text-text-3 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap" title={summary}>
              {summary}
            </span>
            <span className="flex-1" />
            <Space>
              <Button onClick={onClose}>Cancelar</Button>
              <Button type="primary" loading={formState.isSubmitting} onClick={handleSubmit(onSubmit)}>
                {mode === 'new' ? 'Abrir terminal' : 'Retomar sessão'}
              </Button>
            </Space>
          </div>
        </div>
      }
    >
      <form
        className="flex flex-col gap-[22px]"
        onSubmit={(event) => {
          event.preventDefault();
          void handleSubmit(onSubmit)();
        }}
        noValidate
      >
        <div>
          <FolderPicker folders={folders} value={cwd} onChange={changeFolder} onFavoritesChanged={reloadFolders} />
          <FieldError name="cwd" errors={formState.errors} />
        </div>

        <SessionPicker
          sessions={sessions}
          mode={mode}
          sessionId={sessionId}
          onModeChange={(next) => {
            setValue('mode', next);
            if (next !== 'resume') setValue('sessionId', undefined);
          }}
          onSessionChange={(id) => setValue('sessionId', id, { shouldValidate: true })}
          error={formState.errors.sessionId?.message}
        />

        <div className="flex flex-col gap-2">
          <label htmlFor="terminal-label" className="text-[13px] font-semibold">
            Nome do terminal
          </label>
          <Controller
            name="label"
            control={control}
            render={({ field }) => (
              <Input
                {...field}
                id="terminal-label"
                placeholder={cwd ? `${folderName(cwd)} (nome da pasta, por omissão)` : 'Nome da pasta, por omissão'}
                status={formState.errors.label ? 'error' : undefined}
                maxLength={80}
              />
            )}
          />
          <FieldError name="label" errors={formState.errors} />
        </div>
      </form>
    </Drawer>
  );
}
