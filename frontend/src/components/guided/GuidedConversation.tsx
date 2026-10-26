import { Button, Select } from 'antd';
import { type ReactNode, useEffect, useRef } from 'react';
import { GuidedFeed } from '@/components/guided/GuidedFeed';
import { PermissionCard } from '@/components/guided/PermissionCard';
import { QuestionCard } from '@/components/guided/QuestionCard';
import { ReplyBox } from '@/components/guided/ReplyBox';
import { answerQuestion, decidePermission, setGuidedMode } from '@/services/guidedService';
import type { Answers, FeedEntry, GuidedMode, GuidedStatus, GuidedView } from '@/types/guided';

/**
 * A conversa de uma sessão guiada sem terminal à vista (design/guided-session.md), partilhada pelo Novo projeto e
 * pela Upwork: o feed e, no fundo, o que o estado pede. Os estados que dependem do propósito (parada, terminada,
 * falhou) e o envio de texto ficam com quem a usa.
 */

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

function lastActivity(entries: FeedEntry[]): string | null {
  const entry = entries.at(-1);
  return entry?.type === 'activity' ? entry.summary : null;
}

export function GuidedConversation({ view, entries, busy, act, onReveal, onSend, endPanel = null, copyable = false }: GuidedConversationProps) {
  const bottom = useRef<HTMLDivElement>(null);
  const lastEntryId = entries.at(-1)?.id;
  const requestId = view.pending?.requestId;
  useEffect(() => {
    bottom.current?.scrollIntoView({ block: 'end', behavior: 'smooth' });
  }, [entries.length, lastEntryId, view.status, requestId]);

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
      bottomPanel = <ReplyBox busy={busy} onSend={onSend} />;
      break;
    case 'needs-you':
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

  return (
    <div className="flex flex-col gap-6">
      <GuidedFeed entries={entries} copyable={copyable} />
      {bottomPanel}
      <div ref={bottom} />
    </div>
  );
}
