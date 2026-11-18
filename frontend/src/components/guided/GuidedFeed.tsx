import { CheckOutlined, CloseOutlined, ToolOutlined } from '@ant-design/icons';
import { CopyButton } from '@/components/common/CopyButton';
import { Markdown } from '@/components/common/Markdown';
import type { Answers, FeedEntry, Question } from '@/types/guided';
import { displayLabel } from './questionLabels';

/** `copyable`: um **Copiar** ao lado do nome (a Upwork copia as respostas propostas para a conversa com o cliente). */
export function AssistantMessage({ markdown, copyable = false }: { markdown: string; copyable?: boolean }) {
  return (
    <div className="flex flex-col gap-1 max-w-full">
      <div className="flex items-center justify-between gap-2 min-h-6">
        <span className="kicker">Claude</span>
        {copyable && <CopyButton text={markdown} />}
      </div>
      <Markdown>{markdown}</Markdown>
    </div>
  );
}

export function UserMessage({ text }: { text: string }) {
  return (
    <div className="flex justify-end">
      <div className="chat-user max-w-[85%] text-[14px] leading-[21px]">{text}</div>
    </div>
  );
}

/** Uma pergunta já respondida, compacta: o que se perguntou e o que se escolheu. */
export function AnsweredQuestion({ questions, answers }: { questions: Question[]; answers: Answers }) {
  return (
    <div className="flex flex-col gap-1.5 border-l-2 border-accent-border pl-3">
      {questions.map((q) => (
        <div key={q.question} className="flex flex-col gap-0.5">
          <span className="text-[12.5px] leading-[18px] text-text-3">{q.question}</span>
          <span className="text-[13.5px] leading-[20px] text-text-1 font-medium">{displayLabel(answers[q.question] ?? '—')}</span>
        </div>
      ))}
    </div>
  );
}

export function ActivityLine({ summary }: { summary: string }) {
  return (
    <div className="feed-line">
      <ToolOutlined aria-hidden />
      <span>{summary}</span>
    </div>
  );
}

/** Uma permissão já decidida: ✓ permitida / ✕ recusada, sobre quê, e onde — quando não foi nesta página. */
export function PermissionLine({ summary, decision, where }: { summary: string; decision: 'allow' | 'deny' | null; where?: string | undefined }) {
  const allowed = decision === 'allow';
  return (
    <div className="feed-line">
      {allowed ? <CheckOutlined aria-hidden className="text-success" /> : <CloseOutlined aria-hidden className="text-error" />}
      <span>{allowed ? 'Permitido' : 'Recusado'}</span>
      {where && <span className="text-text-3">{where}</span>}
      <span className="feed-target">{summary}</span>
    </div>
  );
}

function Entry({ entry, copyable, outsideLabel }: { entry: FeedEntry; copyable: boolean; outsideLabel: string }) {
  switch (entry.type) {
    case 'assistant-text':
      return <AssistantMessage markdown={entry.markdown} copyable={copyable} />;
    case 'user-text':
      return <UserMessage text={entry.text} />;
    case 'question':
      return entry.answers ? <AnsweredQuestion questions={entry.questions} answers={entry.answers} /> : null;
    case 'permission':
      return <PermissionLine summary={entry.summary} decision={entry.decision} where={entry.outside ? outsideLabel : undefined} />;
    case 'activity':
      return <ActivityLine summary={entry.summary} />;
  }
}

/**
 * A conversa de uma sessão guiada, de cima para baixo (spec §4.4). Genérica: não sabe que é o `/create`. Uma
 * pergunta ainda por responder não aparece aqui — está no cartão por baixo do feed. Cada entrada leva
 * `data-entry-id`, por onde o índice das mensagens a encontra; descer sozinha é com quem a usa (`useStickToBottom`).
 */
export function GuidedFeed({
  entries,
  copyable = false,
  outsideLabel = 'fora desta página',
}: {
  entries: FeedEntry[];
  copyable?: boolean;
  /** Onde foram decididas as permissões que não passaram pela página (ADR 0033: "no Claude app"). */
  outsideLabel?: string;
}) {
  return (
    <div className="flex flex-col gap-4" role="log" aria-label="Conversa" aria-live="polite">
      {entries.map((entry) =>
        entry.type === 'question' && !entry.answers ? null : (
          <div key={entry.id} data-entry-id={entry.id} className="scroll-mt-6">
            <Entry entry={entry} copyable={copyable} outsideLabel={outsideLabel} />
          </div>
        ),
      )}
    </div>
  );
}
