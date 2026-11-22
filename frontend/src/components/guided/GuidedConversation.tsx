import { ArrowDownOutlined } from '@ant-design/icons';
import { Button, Select } from 'antd';
import { type ReactNode, useMemo, useRef, useState } from 'react';
import { GuidedFeed } from '@/components/guided/GuidedFeed';
import { MessageIndex } from '@/components/guided/MessageIndex';
import { ownerMessages } from '@/components/guided/ownerMessages';
import { PermissionCard } from '@/components/guided/PermissionCard';
import { QuestionCard } from '@/components/guided/QuestionCard';
import { ReplyBox } from '@/components/guided/ReplyBox';
import { useStickToBottom } from '@/components/guided/useStickToBottom';
import { answerQuestion, decidePermission, setGuidedDisplay, setGuidedMode } from '@/services/guidedService';
import type { Answers, FeedEntry, GuidedMode, GuidedStatus, GuidedView } from '@/types/guided';

/**
 * A conversa de uma sessão guiada sem terminal à vista (design/guided-session.md), partilhada pelo Novo projeto e
 * pela Upwork: o feed e, no fundo, o que o estado pede. Os estados que dependem do propósito (parada, terminada,
 * falhou) e o envio de texto ficam com quem a usa.
 */

const STATUS_TAG: Record<GuidedStatus, { className: string; icon: string; label: string }> = {
  working: { className: 'tag-work', icon: 'is-work', label: 'A trabalhar' },
  question: { className: 'tag-wait', icon: 'is-wait', label: 'Precisa de ti' },
  permission: { className: 'tag-wait', icon: 'is-wait', label: 'Precisa de ti' },
  'waiting-text': { className: 'tag-wait', icon: 'is-idle', label: 'À tua espera' },
  'needs-you': { className: 'tag-wait', icon: 'is-wait', label: 'Precisa de ti' },
  stopped: { className: 'tag-stop', icon: 'is-stop', label: 'Parada' },
  done: { className: 'tag-run', icon: 'is-run', label: 'Criado' },
  failed: { className: 'tag-err', icon: 'is-err', label: 'Falhou' },
};

/** `labels` muda o texto de um estado para o propósito (numa candidatura, `stopped` é "Em pausa"). */
export function GuidedStatusTag({ status, labels }: { status: GuidedStatus; labels?: Partial<Record<GuidedStatus, string>> }) {
  const tag = STATUS_TAG[status];
  return (
    <span className={tag.className} data-status={status}>
      <span className={`state-icon ${tag.icon}`} aria-hidden />
      {labels?.[status] ?? tag.label}
    </span>
  );
}

const MODE_OPTIONS: { value: GuidedMode; label: string; title: string }[] = [
  { value: 'ask', label: 'Perguntar', title: 'Cada permissão pede-te Permitir ou Recusar' },
  { value: 'auto', label: 'Automático', title: 'A app aprova as permissões sem perguntar; as escolhas continuam a ser cartões' },
];

/** Perguntar / Automático (ADR 0021): troca na hora, sem confirmação. */
export function GuidedModeSelect({ view, busy, act }: { view: GuidedView; busy: boolean; act: GuidedAct }) {
  return (
    <label className="flex items-center gap-1.5 text-[12.5px] text-text-3">
      Permissões
      <Select<GuidedMode>
        size="small"
        aria-label="Permissões"
        className="w-[120px]"
        value={view.mode}
        options={MODE_OPTIONS}
        disabled={busy}
        onChange={(mode) => void act(() => setGuidedMode(view.id, mode))}
      />
    </label>
  );
}

type GuidedAct = (action: () => Promise<unknown>) => Promise<boolean>;

type GuidedConversationProps = {
  view: GuidedView;
  entries: FeedEntry[];
  busy: boolean;
  act: GuidedAct;
  onReveal: () => void;
  /** Escrever ao Claude no `waiting-text` — cada propósito tem a sua rota (a Upwork acorda uma sessão em pausa). */
  onSend: (text: string) => Promise<boolean>;
  /** O painel do fundo para `stopped`, `done` e `failed`, que dependem do propósito. */
  endPanel?: ReactNode;
  /** **Copiar** nas mensagens do Claude. */
  copyable?: boolean;
};

function JumpToEndButton({ onClick }: { onClick: () => void }) {
  return (
    <Button
      shape="circle"
      icon={<ArrowDownOutlined />}
      aria-label="Ir para o fim da conversa"
      title="Ir para o fim"
      className="shadow-overlay"
      onClick={onClick}
      data-jump-to-end
    />
  );
}

/**
 * ADR 0033, "Esconder aqui": no lugar da conversa, o aviso de que o terminal continua em fundo e a resposta é no
 * Claude app. O cabeçalho e o painel do fim (parada, criada, falhou) ficam com quem usa a conversa.
 */
function InAppNotice({ busy, onShow }: { busy: boolean; onShow: () => void }) {
  return (
    <section className="card p-5 flex items-start gap-3" aria-label="No Claude app" data-in-app-notice>
      <span className="state-icon is-work mt-1" aria-hidden />
      <div className="flex-1 flex flex-col gap-1">
        <span className="text-[14px] font-semibold text-text-1">A responder no Claude app</span>
        <span className="text-[13.5px] leading-[20px] text-text-2">
          Há um terminal a correr em fundo com esta criação. As escolhas e as permissões aparecem no Claude app; quando acabar, o resumo aparece aqui.
        </span>
      </div>
      <Button size="small" disabled={busy} onClick={onShow}>
        Mostrar a conversa
      </Button>
    </section>
  );
}

/** "Manter aberto": a faixa que lembra onde se responde, com a troca para Esconder aqui. */
function InAppBanner({ busy, waiting, onHide }: { busy: boolean; waiting: boolean; onHide: () => void }) {
  return (
    <div className="status-banner flex items-center gap-3 px-4 py-2.5" role="status" data-in-app-banner>
      <span className={`state-icon ${waiting ? 'is-wait' : 'is-work'}`} aria-hidden />
      <span className="flex-1 text-[13.5px] leading-[20px]">
        {waiting ? 'No Claude app: há uma escolha ou uma permissão que precisa de ti lá.' : 'No Claude app: as escolhas e as permissões respondem-se lá.'}
      </span>
      <Button size="small" type="text" disabled={busy} onClick={onHide}>
        Esconder aqui
      </Button>
    </div>
  );
}

function lastActivity(entries: FeedEntry[]): string | null {
  const entry = entries.at(-1);
  return entry?.type === 'activity' ? entry.summary : null;
}

export function GuidedConversation({ view, entries, busy, act, onReveal, onSend, endPanel = null, copyable = false }: GuidedConversationProps) {
  const root = useRef<HTMLDivElement>(null);
  const ownerCount = useMemo(() => ownerMessages(entries).length, [entries]);
  const changeKey = `${entries.length}|${entries.at(-1)?.id}|${view.status}|${view.pending?.requestId}`;
  const { away, jumpToEnd } = useStickToBottom(root, changeKey, ownerCount);
  const [reserveIndex, setReserveIndex] = useState(false);
  const live = view.status !== 'stopped' && view.status !== 'done' && view.status !== 'failed';
  const inApp = view.remote && live;
  const display = (next: 'hidden' | 'open') => void act(() => setGuidedDisplay(view.id, next));

  let bottomPanel: ReactNode = endPanel;
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
            onSubmit={(answers: Answers) => void act(() => answerQuestion(view.id, questionId, answers))}
          />
        );
      }
      break;
    case 'permission':
      if (view.pending?.type === 'permission') {
        const { requestId: permissionId, tool, summary } = view.pending;
        bottomPanel = (
          <PermissionCard
            key={permissionId}
            tool={tool}
            summary={summary}
            busy={busy}
            onDecide={(decision) => void act(() => decidePermission(view.id, permissionId, decision))}
          />
        );
      }
      break;
    case 'waiting-text':
      // Presa ao fundo da área com scroll: escreve-se a resposta enquanto se relê a conversa lá em cima.
      bottomPanel = (
        <div className="sticky bottom-0 z-10 -mx-1 px-1 pt-2 pb-4 bg-bg" data-reply-dock>
          {away && (
            <div className="absolute left-1/2 -translate-x-1/2 -top-12">
              <JumpToEndButton onClick={jumpToEnd} />
            </div>
          )}
          <ReplyBox busy={busy} onSend={onSend} maxRows={8} />
        </div>
      );
      break;
    case 'needs-you':
      // In the app, a question or permission is asked there — the hook leaves it to Claude Code's own prompt.
      if (inApp) {
        bottomPanel = null;
        break;
      }
      bottomPanel = (
        <div className="status-banner is-wait flex items-center gap-3 px-4 py-2.5" role="status">
          <span className="state-icon is-wait" aria-hidden />
          <span className="flex-1 text-[13.5px] leading-[20px]">A sessão precisa de algo que esta vista não mostra.</span>
          <Button size="small" type="primary" disabled={busy} onClick={onReveal}>
            Ver terminal
          </Button>
        </div>
      );
      break;
  }

  if (inApp && view.display === 'hidden') {
    return (
      <div ref={root} className="flex flex-col gap-6">
        <InAppNotice busy={busy} onShow={() => display('open')} />
      </div>
    );
  }

  return (
    <div ref={root} className={`flex flex-col gap-6${reserveIndex ? ' pr-10' : ''}`}>
      <GuidedFeed entries={entries} copyable={copyable} outsideLabel={view.remote ? 'no Claude app' : undefined} />
      {inApp && <InAppBanner busy={busy} waiting={view.status === 'needs-you'} onHide={() => display('hidden')} />}
      {bottomPanel}
      {away && view.status !== 'waiting-text' && (
        // Preso ao fundo da área com scroll; a altura 0 (e o -mt-6 que anula o gap) não mexe no fim da conversa.
        <div className="sticky bottom-4 z-20 h-0 -mt-6 flex justify-center">
          <div className="absolute bottom-0">
            <JumpToEndButton onClick={jumpToEnd} />
          </div>
        </div>
      )}
      <MessageIndex entries={entries} onOverlap={setReserveIndex} />
    </div>
  );
}
