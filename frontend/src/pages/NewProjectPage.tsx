import { CodeOutlined } from '@ant-design/icons';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button, Input, Select, Spin } from 'antd';
import { isAxiosError } from 'axios';
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useNavigate } from 'react-router';
import { z } from 'zod';
import { FieldError } from '@/components/common/FieldError';
import { Markdown } from '@/components/common/Markdown';
import { GuidedFeed } from '@/components/guided/GuidedFeed';
import { PermissionCard } from '@/components/guided/PermissionCard';
import { QuestionCard } from '@/components/guided/QuestionCard';
import { ReplyBox } from '@/components/guided/ReplyBox';
import { ErrorHandler } from '@/errors/errorHandler';
import { useConfirm } from '@/hooks/useConfirm';
import { useGuidedSession } from '@/hooks/useGuidedSession';
import { getCurrentCreation, openCreatedProject, startCreation } from '@/services/creationService';
import { answerQuestion, decidePermission, removeGuided, resumeGuided, revealGuided, sendGuidedMessage, setGuidedMode } from '@/services/guidedService';
import type { Answers, GuidedMode, GuidedStatus, GuidedView } from '@/types/guided';

/**
 * A descrição é texto livre para o Claude (vai para o brief que o `/create` lê): sem lista branca de caracteres,
 * como uma mensagem; o backend aceita até 8000.
 */
const briefSchema = z.object({ description: z.string().trim().min(1, 'Descreve a app que queres criar.').max(8000, 'Até 8000 caracteres.') });
type BriefValues = z.infer<typeof briefSchema>;

/** O terminal escondido arranca com este tamanho; ao ser revelado, a grelha ajusta-o. */
const RESUME_SIZE = { cols: 120, rows: 40 };

const STATUS_TAG: Record<GuidedStatus, { className: string; icon: string; label: string }> = {
  working: { className: 'tag-work', icon: 'is-work', label: 'A trabalhar' },
  question: { className: 'tag-wait', icon: 'is-wait', label: 'À tua espera' },
  permission: { className: 'tag-wait', icon: 'is-wait', label: 'À tua espera' },
  'waiting-text': { className: 'tag-wait', icon: 'is-wait', label: 'À tua espera' },
  'needs-you': { className: 'tag-wait', icon: 'is-wait', label: 'À tua espera' },
  stopped: { className: 'tag-stop', icon: 'is-stop', label: 'Parada' },
  done: { className: 'tag-run', icon: 'is-run', label: 'Criado' },
  failed: { className: 'tag-err', icon: 'is-err', label: 'Falhou' },
};

function PageHeader({ title, extra }: { title: ReactNode; extra?: ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-4 flex-wrap">
      <div>
        <div className="kicker">Novo projeto</div>
        <div className="text-display">{title}</div>
      </div>
      {extra && <div className="flex items-center gap-2">{extra}</div>}
    </div>
  );
}

/** Estado 1 (spec §4.4): a descrição livre e **Começar**. */
function StartForm({ onStarted, onConflict }: { onStarted: (view: GuidedView) => void; onConflict: () => void }) {
  const form = useForm<BriefValues>({ resolver: zodResolver(briefSchema), defaultValues: { description: '' } });
  const [busy, setBusy] = useState(false);
  const submit = form.handleSubmit(async ({ description }) => {
    setBusy(true);
    try {
      onStarted(await startCreation(description));
    } catch (e) {
      const fieldErrors = isAxiosError(e) ? e.response?.data?.fieldErrors : undefined;
      fieldErrors?.forEach(({ field }: { field: string }) => {
        if (field === 'description') form.setError('description', { message: 'Descrição inválida (vazia ou longa demais).' });
      });
      ErrorHandler.handle(e);
      // Outra criação começou entretanto (noutro separador): mostra-se essa.
      if (isAxiosError(e) && e.response?.data?.errorCode === 'CREATE_001') onConflict();
    } finally {
      setBusy(false);
    }
  });

  return (
    <form className="flex flex-col gap-4" onSubmit={(event) => void submit(event)} noValidate>
      <PageHeader title="Descreve a app" />
      <p className="text-text-2 text-[14px] leading-[21px] m-0">
        O <span className="font-mono">/create</span> do Workflow faz a entrevista a partir daqui: o que a descrição não responder, ele pergunta.
        As escolhas aparecem como cartões e as permissões como Permitir/Recusar — sem terminal.
      </p>
      <Controller
        name="description"
        control={form.control}
        render={({ field }) => (
          <Input.TextArea
            {...field}
            id="new-project-description"
            aria-label="Descrição da app"
            autoFocus
            autoSize={{ minRows: 8, maxRows: 20 }}
            maxLength={8000}
            showCount
            disabled={busy}
            placeholder="Descreve a app: o que faz, para quem, o que tem de ter…"
          />
        )}
      />
      <FieldError id="new-project-description-error" name="description" errors={form.formState.errors} />
      <p className="text-text-3 text-[12.5px] leading-[18px] m-0">
        Ajuda dizer: o nome (provisório serve) · que problema resolve e como se faz hoje · quem a usa, onde e como · que papéis há e o
        que cada um pode fazer · o mínimo que já te serve · as “coisas” principais e como se relacionam · os dois ecrãs mais
        importantes · se é só para ti ou um produto para vários.
      </p>
      <div className="flex justify-end">
        <Button type="primary" htmlType="submit" loading={busy}>
          Começar
        </Button>
      </div>
    </form>
  );
}

function lastActivity(view: ReturnType<typeof useGuidedSession>['entries']): string | null {
  const entry = view.at(-1);
  return entry?.type === 'activity' ? entry.summary : null;
}

const MODE_OPTIONS: { value: GuidedMode; label: string; title: string }[] = [
  { value: 'ask', label: 'Perguntar', title: 'Cada permissão pede-te Permitir ou Recusar' },
  { value: 'auto', label: 'Automático', title: 'A app aprova as permissões sem perguntar; as escolhas continuam a ser cartões' },
];

/** Estados 2 e 3 (spec §4.4): a conversa e, no fundo, o que o estado pede; ou o fim. */
function CreationSession({ id, onGone }: { id: string; onGone: () => void }) {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const { view, entries, gone, refresh } = useGuidedSession(id);
  const [busy, setBusy] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (gone) onGone();
  }, [gone, onGone]);

  const lastEntryId = entries.at(-1)?.id;
  const requestId = view?.pending?.requestId;
  useEffect(() => {
    bottom.current?.scrollIntoView({ block: 'end', behavior: 'smooth' });
  }, [entries.length, lastEntryId, view?.status, requestId]);

  /** Uma ação do dono: desativa tudo enquanto corre, e no fim relê a sessão (os erros vão ao ErrorHandler). */
  const act = async (action: () => Promise<unknown>): Promise<boolean> => {
    setBusy(true);
    try {
      await action();
      return true;
    } catch (e) {
      ErrorHandler.handle(e);
      return false;
    } finally {
      setBusy(false);
      refresh();
    }
  };

  const reveal = () =>
    void act(async () => {
      const terminal = await revealGuided(id);
      void navigate('/terminals', { state: { focusTerminalId: terminal.id } });
    });

  const remove = (finished: boolean) =>
    confirm({
      title: finished ? 'Fechar esta criação?' : 'Cancelar a criação?',
      actionLabel: finished ? 'Fechar' : 'Cancelar criação',
      danger: !finished,
      message: finished
        ? 'O resumo deixa de aparecer aqui; a conversa fica no histórico dos terminais. O projeto não é tocado.'
        : 'A sessão do Claude termina. Se a geração já começou, a pasta do projeto pode ficar a meio — a app não a apaga; apaga-a à mão.',
      onConfirm: async () => {
        if (await act(() => removeGuided(id))) onGone();
      },
    });

  if (!view) {
    return (
      <div className="flex justify-center py-16">
        <Spin />
      </div>
    );
  }

  const tag = STATUS_TAG[view.status];
  const finished = view.status === 'done' || view.status === 'failed';
  const title = view.status === 'done' ? (view.result?.projectName ?? 'Projeto criado') : view.status === 'failed' ? 'A criação não terminou' : 'A criar o projeto';

  let bottomPanel: ReactNode = null;
  switch (view.status) {
    case 'working': {
      const activity = lastActivity(entries);
      bottomPanel = (
        <div className="feed-line" role="status">
          <span className="state-icon is-work" aria-hidden />
          <span>O Claude está a trabalhar…</span>
          {activity && <span className="text-text-3">· {activity}</span>}
        </div>
      );
      break;
    }
    case 'question':
      if (view.pending?.type === 'question') {
        const { requestId: questionId, questions } = view.pending;
        bottomPanel = (
          <QuestionCard
            key={questionId}
            questions={questions}
            busy={busy}
            onSubmit={(answers: Answers) => void act(() => answerQuestion(id, questionId, answers))}
          />
        );
      }
      break;
    case 'permission':
      if (view.pending?.type === 'permission') {
        const { requestId: permissionId, tool, summary } = view.pending;
        bottomPanel = (
          <PermissionCard key={permissionId} tool={tool} summary={summary} busy={busy} onDecide={(decision) => void act(() => decidePermission(id, permissionId, decision))} />
        );
      }
      break;
    case 'waiting-text':
      bottomPanel = <ReplyBox busy={busy} onSend={(text) => act(() => sendGuidedMessage(id, text))} />;
      break;
    case 'needs-you':
      bottomPanel = (
        <div className="status-banner is-wait flex items-center gap-3 px-4 py-2.5" role="status">
          <span className="state-icon is-wait" aria-hidden />
          <span className="flex-1 text-[13.5px] leading-[20px]">A sessão precisa de algo que esta vista não mostra.</span>
          <Button size="small" type="primary" disabled={busy} onClick={reveal}>
            Ver terminal
          </Button>
        </div>
      );
      break;
    case 'stopped':
      bottomPanel = (
        <div className="status-banner is-stop flex items-center gap-3 px-4 py-2.5" role="status">
          <span className="state-icon is-stop" aria-hidden />
          <span className="flex-1 text-[13.5px] leading-[20px]">A sessão parou (o backend reiniciou?). Retomar continua a conversa onde ficou.</span>
          <Button size="small" type="primary" loading={busy} onClick={() => void act(() => resumeGuided(id, RESUME_SIZE))}>
            Retomar
          </Button>
        </div>
      );
      break;
    case 'done':
      bottomPanel = view.result && (
        <section className="card p-5 flex flex-col gap-4" aria-label="Projeto criado">
          <div className="flex items-center gap-2">
            <span className="state-icon is-run" aria-hidden />
            <span className="text-[16px] leading-[24px] font-semibold">Projeto criado</span>
          </div>
          {view.result.projectPath && <div className="code-line">{view.result.projectPath}</div>}
          {view.result.summary && <Markdown>{view.result.summary}</Markdown>}
          {view.result.openDecisions.length > 0 && (
            <div className="flex flex-col gap-1">
              <div className="kicker">Decisões em aberto</div>
              <ul className="m-0 pl-5 list-disc text-text-2 text-[14px] leading-[21px]">
                {view.result.openDecisions.map((decision) => (
                  <li key={decision}>{decision}</li>
                ))}
              </ul>
            </div>
          )}
          {view.result.nextStep && (
            <div className="text-text-2 text-[14px]">
              Próximo passo: <span className="font-mono text-text-1">{view.result.nextStep}</span>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button disabled={busy} onClick={() => remove(true)}>
              Fechar
            </Button>
            <Button
              type="primary"
              loading={busy}
              onClick={() =>
                void act(async () => {
                  const terminal = await openCreatedProject(id);
                  void navigate('/terminals', { state: { focusTerminalId: terminal.id } });
                })
              }
            >
              Abrir projeto
            </Button>
          </div>
        </section>
      );
      break;
    case 'failed':
      bottomPanel = (
        <section className="status-banner is-err p-4 flex flex-col gap-3" aria-label="A criação falhou">
          <div className="flex items-center gap-2">
            <span className="state-icon is-err" aria-hidden />
            <span className="text-[14px] font-semibold">{view.result?.error ?? view.error ?? 'A criação terminou sem resultado.'}</span>
          </div>
          {view.result?.summary && <Markdown>{view.result.summary}</Markdown>}
          <div className="flex justify-end gap-2">
            <Button disabled={busy} onClick={reveal}>
              Ver terminal
            </Button>
            <Button type="primary" disabled={busy} onClick={() => remove(true)}>
              Fechar
            </Button>
          </div>
        </section>
      );
      break;
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={title}
        extra={
          <>
            <span className={tag.className} data-status={view.status}>
              <span className={`state-icon ${tag.icon}`} aria-hidden />
              {tag.label}
            </span>
            {!finished && (
              <label className="flex items-center gap-1.5 text-[12.5px] text-text-3">
                Permissões
                <Select<GuidedMode>
                  size="small"
                  aria-label="Permissões"
                  className="w-[120px]"
                  value={view.mode}
                  options={MODE_OPTIONS}
                  disabled={busy}
                  onChange={(mode) => void act(() => setGuidedMode(id, mode))}
                />
              </label>
            )}
            <Button size="small" icon={<CodeOutlined />} disabled={busy} onClick={reveal}>
              Ver terminal
            </Button>
            {!finished && (
              <Button size="small" type="text" danger disabled={busy} onClick={() => remove(false)}>
                Cancelar
              </Button>
            )}
          </>
        }
      />
      <GuidedFeed entries={entries} />
      {bottomPanel}
      <div ref={bottom} />
    </div>
  );
}

/**
 * Ecrã "Novo projeto" (`/new-project`, spec novo-projeto-guiado §4.4): sem criação, a descrição e Começar; com uma
 * a decorrer (a sessão continua com o browser fechado — volta-se a ela aqui), a conversa e os cartões; terminada,
 * o resumo e **Abrir projeto**. Uma criação de cada vez.
 */
export function NewProjectPage() {
  const [current, setCurrent] = useState<GuidedView | null | undefined>(undefined);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getCurrentCreation()
      .then((view) => !cancelled && setCurrent(view))
      .catch((e: unknown) => {
        ErrorHandler.handle(e);
        if (!cancelled) setCurrent(null);
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);

  return (
    <div className="mx-auto max-w-[760px] px-6 py-8">
      {current === undefined ? (
        <div className="flex justify-center py-16">
          <Spin />
        </div>
      ) : current === null ? (
        <StartForm onStarted={setCurrent} onConflict={reload} />
      ) : (
        <CreationSession key={current.id} id={current.id} onGone={reload} />
      )}
    </div>
  );
}
