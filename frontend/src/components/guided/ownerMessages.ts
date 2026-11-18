import type { FeedEntry } from '@/types/guided';
import { displayLabel } from './questionLabels';

/** Uma mensagem do dono no índice: o brief, um texto, ou as respostas a uma pergunta. */
export type OwnerMessage = { id: string; text: string };

/** O que o dono escreveu ou respondeu, pela ordem da conversa. Uma pergunta por responder não conta. */
export function ownerMessages(entries: FeedEntry[]): OwnerMessage[] {
  const messages: OwnerMessage[] = [];
  for (const entry of entries) {
    if (entry.type === 'user-text') messages.push({ id: entry.id, text: entry.text });
    else if (entry.type === 'question' && entry.answers) {
      const answers = entry.answers;
      const text = entry.questions
        .map((q) => answers[q.question])
        .filter((answer): answer is string => Boolean(answer))
        .map(displayLabel)
        .join(' · ');
      messages.push({ id: entry.id, text });
    }
  }
  return messages;
}

/** O id que o feed põe no DOM de cada entrada, para o índice a encontrar e saltar até ela. */
export function entryElement(id: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-entry-id="${CSS.escape(id)}"]`);
}
