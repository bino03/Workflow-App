import { CheckOutlined, CloseOutlined, ToolOutlined } from '@ant-design/icons';
import { useEffect, useRef } from 'react';
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

/** Uma permissão já decidida: ✓ permitida / ✕ recusada, e sobre quê. */
export function PermissionLine({ summary, decision }: { summary: string; decision: 'allow' | 'deny' | null }) {
  const allowed = decision === 'allow';
  return (
    <div className="feed-line">
      {allowed ? <CheckOutlined aria-hidden className="text-success" /> : <CloseOutlined aria-hidden className="text-error" />}
      <span>{allowed ? 'Permitido' : 'Recusado'}</span>
      <span className="feed-target">{summary}</span>
    </div>
  );
}

function Entry({ entry, copyable }: { entry: FeedEntry; copyable: boolean }) {
  switch (entry.type) {
    case 'assistant-text':
      return <AssistantMessage markdown={entry.markdown} copyable={copyable} />;
    case 'user-text':
      return <UserMessage text={entry.text} />;
    case 'question':
      return entry.answers ? <AnsweredQuestion questions={entry.questions} answers={entry.answers} /> : null;
    case 'permission':
      return <PermissionLine summary={entry.summary} decision={entry.decision} />;
    case 'activity':
      return <ActivityLine summary={entry.summary} />;
  }
}

/**
 * A conversa de uma sessão guiada, de cima para baixo (spec §4.4). Genérica: não sabe que é o `/create`. Uma
 * pergunta ainda por responder não aparece aqui — está no cartão por baixo do feed. Desce sozinha quando chega
 * uma entrada nova.
 */
export function GuidedFeed({ entries, copyable = false }: { entries: FeedEntry[]; copyable?: boolean }) {
  const end = useRef<HTMLDivElement>(null);
  const last = entries.at(-1);
  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end', behavior: 'smooth' });
  }, [entries.length, last?.id]);

  return (
    <div className="flex flex-col gap-4" role="log" aria-label="Conversa" aria-live="polite">
      {entries.map((entry) => (
        <Entry key={entry.id} entry={entry} copyable={copyable} />
      ))}
      <div ref={end} />
    </div>
  );
}
