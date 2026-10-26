import type { ReactNode } from 'react';
import { CopyButton } from '@/components/common/CopyButton';
import { Markdown } from '@/components/common/Markdown';
import { VERDICT_TAG, formatDateTime } from '@/components/upwork/upworkFormat';
import type { PackageView } from '@/types/upwork';

type PartKey = 'analysis' | 'coverLetter' | 'screening' | 'plan' | 'clientQuestions';

/** Pela ordem em que se usam: decidir, escrever, responder, preparar. `forClient` = vai na língua do anúncio. */
const PARTS: { key: PartKey; title: string; forClient: boolean }[] = [
  { key: 'analysis', title: 'Análise', forClient: false },
  { key: 'coverLetter', title: 'Carta', forClient: true },
  { key: 'screening', title: 'Respostas de triagem', forClient: true },
  { key: 'plan', title: 'Plano técnico', forClient: false },
  { key: 'clientQuestions', title: 'Perguntas ao cliente', forClient: true },
];

function PartCard({ title, note, markdown, extra }: { title: string; note: string; markdown: string | null; extra?: ReactNode }) {
  return (
    <section className="card p-4 flex flex-col gap-3" aria-label={title}>
      <div className="flex items-center gap-2">
        <span className="text-[14px] leading-[20px] font-semibold text-text-1">{title}</span>
        {extra}
        <span className="text-[12px] text-text-3">{note}</span>
        <span className="flex-1" />
        {markdown !== null && <CopyButton text={markdown} />}
      </div>
      {markdown !== null ? (
        <Markdown>{markdown}</Markdown>
      ) : (
        <span className="text-[13px] text-text-3">A skill não escreveu esta parte.</span>
      )}
    </section>
  );
}

/** O pacote da candidatura (spec upwork §4.4): um cartão por parte, cada um com **Copiar** do Markdown cru. */
export function PackageCards({ pack }: { pack: PackageView }) {
  const verdict = VERDICT_TAG[pack.verdict];
  return (
    <div className="flex flex-col gap-4">
      <p className="m-0 text-[12.5px] text-text-3">
        Atualizado <span className="font-mono">{formatDateTime(pack.updatedAt)}</span> · o que vai ao cliente está em{' '}
        <span className="font-mono">{pack.language}</span>. Pede mudanças na Conversa ("mais curta", "realça o projeto X").
      </p>
      {PARTS.map((part) => (
        <PartCard
          key={part.key}
          title={part.title}
          note={part.forClient ? 'para o cliente' : 'para ti'}
          markdown={pack[part.key]}
          extra={part.key === 'analysis' ? <span className={verdict.className}>{verdict.label}</span> : undefined}
        />
      ))}
    </div>
  );
}

/** Enquanto a skill escreve: os mesmos cartões, vazios, para se ver o que aí vem. */
export function PackagePlaceholder() {
  return (
    <div className="flex flex-col gap-2" aria-label="Pacote a gerar">
      {PARTS.map((part) => (
        <div key={part.key} className="card px-4 py-3 flex items-center gap-2 opacity-60">
          <span className="state-icon is-work" aria-hidden />
          <span className="text-[13.5px] text-text-2">{part.title}</span>
          <span className="text-[12px] text-text-3">em espera</span>
        </div>
      ))}
    </div>
  );
}
