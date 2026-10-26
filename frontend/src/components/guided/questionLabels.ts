import { OTHER_OPTION, type Answers, type Question } from '@/types/guided';

/** O Claude marca a opção que recomenda no próprio label; a UI mostra-a como etiqueta. */
const RECOMMENDED = /\s*\((recommended|recomendad[oa])\)\s*$/i;

export function isRecommended(label: string): boolean {
  return RECOMMENDED.test(label);
}

/** O label sem a marca. A resposta enviada leva o label **tal como veio** — é por ele que o Claude a reconhece. */
export function displayLabel(label: string): string {
  return label.replace(RECOMMENDED, '');
}

/** O que o dono escolheu numa pergunta: labels (pela ordem das opções) e, se escolheu "Outro", o texto. */
export type QuestionChoice = { labels: string[]; other: string | null };

/**
 * A resposta de uma pergunta no formato da AskUserQuestion: um label; vários separados por ", "; ou o texto do
 * "Outro" (junto aos labels, numa de várias). `null` = ainda sem resposta.
 */
export function answerOf(question: Question, choice: QuestionChoice | undefined): string | null {
  if (!choice) return null;
  const labels = question.options.map((o) => o.label).filter((label) => choice.labels.includes(label));
  const other = choice.other?.trim();
  const parts = choice.other === null ? labels : [...labels, ...(other ? [other] : [])];
  if (choice.other !== null && !other) return null; // "Outro" escolhido mas vazio
  return parts.length > 0 ? parts.join(', ') : null;
}

export function answersOf(questions: Question[], choices: Record<string, QuestionChoice>): Answers | null {
  const answers: Answers = {};
  for (const question of questions) {
    const answer = answerOf(question, choices[question.question]);
    if (answer === null) return null;
    answers[question.question] = answer;
  }
  return answers;
}

export { OTHER_OPTION };
