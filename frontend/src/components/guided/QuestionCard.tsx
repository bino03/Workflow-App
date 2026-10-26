import { Button, Input } from 'antd';
import { useState } from 'react';
import type { Answers, Question } from '@/types/guided';
import { OTHER_OPTION, type QuestionChoice, answersOf, displayLabel, isRecommended } from './questionLabels';

/** O backend aceita até 4000 por resposta; o "Outro" é texto livre para o Claude (ADR 0020 ponto 7). */
const OTHER_MAX = 4000;

type OptionCardProps = {
  label: string;
  description?: string;
  multi: boolean;
  selected: boolean;
  disabled: boolean;
  onClick: () => void;
};

function OptionCard({ label, description, multi, selected, disabled, onClick }: OptionCardProps) {
  return (
    <button
      type="button"
      role={multi ? 'checkbox' : 'radio'}
      aria-checked={selected}
      className={`option-card${selected ? ' is-selected' : ''}`}
      disabled={disabled}
      onClick={onClick}
    >
      <span className={`option-mark${multi ? ' is-multi' : ''}`} aria-hidden />
      <span className="flex-1 min-w-0">
        <span className="flex items-center gap-2 flex-wrap">
          <span className="text-[14px] leading-[20px] font-medium">{displayLabel(label)}</span>
          {isRecommended(label) && <span className="tag-ok">Recomendado</span>}
        </span>
        {description && <span className="block mt-0.5 text-[13px] leading-[18px] text-text-3">{description}</span>}
      </span>
    </button>
  );
}

type QuestionCardProps = {
  questions: Question[];
  /** A resposta está a ser enviada: tudo desativado. */
  busy: boolean;
  onSubmit: (answers: Answers) => void;
};

/**
 * Uma AskUserQuestion em cartões (spec §4.4): uma ou várias perguntas juntas, cada opção um cartão clicável
 * (círculo = uma, quadrado = várias), "Recomendado" destacado, e "Outro" com campo de texto — o Claude Code junta-o
 * sempre, a UI também. Um botão **Responder** para todas, ativo quando cada pergunta tem resposta.
 */
export function QuestionCard({ questions, busy, onSubmit }: QuestionCardProps) {
  const [choices, setChoices] = useState<Record<string, QuestionChoice>>({});
  const answers = answersOf(questions, choices);

  const toggle = (question: Question, label: string) =>
    setChoices((current) => {
      const choice = current[question.question] ?? { labels: [], other: null };
      const labels = question.multiSelect
        ? choice.labels.includes(label)
          ? choice.labels.filter((l) => l !== label)
          : [...choice.labels, label]
        : [label];
      return { ...current, [question.question]: { labels, other: question.multiSelect ? choice.other : null } };
    });

  const toggleOther = (question: Question) =>
    setChoices((current) => {
      const choice = current[question.question] ?? { labels: [], other: null };
      if (choice.other !== null) return { ...current, [question.question]: { ...choice, other: null } };
      return { ...current, [question.question]: { labels: question.multiSelect ? choice.labels : [], other: '' } };
    });

  const setOther = (question: Question, text: string) =>
    setChoices((current) => ({ ...current, [question.question]: { ...(current[question.question] ?? { labels: [] }), other: text } }));

  return (
    <section className="card p-4 flex flex-col gap-5" aria-label="Pergunta do Claude">
      {questions.map((question, index) => {
        const choice = choices[question.question];
        const otherOn = choice?.other !== null && choice?.other !== undefined;
        return (
          <fieldset key={question.question} className="flex flex-col gap-2" aria-describedby={`q-${index}-hint`}>
            {question.header && <div className="kicker">{question.header}</div>}
            <legend className="contents">
              <span className="block text-[16px] leading-[24px] font-semibold text-text-1">{question.question}</span>
            </legend>
            <span id={`q-${index}-hint`} className="text-[12px] leading-[16px] text-text-3">
              {question.multiSelect ? 'Podes escolher várias.' : 'Escolhe uma.'}
            </span>
            <div className="flex flex-col gap-1.5" role={question.multiSelect ? 'group' : 'radiogroup'}>
              {question.options.map((option) => (
                <OptionCard
                  key={option.label}
                  label={option.label}
                  description={option.description}
                  multi={question.multiSelect}
                  selected={choice?.labels.includes(option.label) ?? false}
                  disabled={busy}
                  onClick={() => toggle(question, option.label)}
                />
              ))}
              <OptionCard
                label={OTHER_OPTION}
                description="Escrever outra resposta."
                multi={question.multiSelect}
                selected={otherOn}
                disabled={busy}
                onClick={() => toggleOther(question)}
              />
              {otherOn && (
                <Input.TextArea
                  autoFocus
                  aria-label={`Outra resposta a: ${question.question}`}
                  value={choice?.other ?? ''}
                  maxLength={OTHER_MAX}
                  autoSize={{ minRows: 1, maxRows: 6 }}
                  disabled={busy}
                  placeholder="A tua resposta"
                  onChange={(event) => setOther(question, event.target.value)}
                />
              )}
            </div>
          </fieldset>
        );
      })}
      <div className="flex justify-end">
        <Button type="primary" disabled={answers === null} loading={busy} onClick={() => answers && onSubmit(answers)}>
          Responder
        </Button>
      </div>
    </section>
  );
}
