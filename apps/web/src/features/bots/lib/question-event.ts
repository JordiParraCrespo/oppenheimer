import type { BotQuestionEvent } from '@oppenheimer/shared/schemas/bot';
import type { TFunction } from 'i18next';

/** A decided card of questions as the export writes it: its line, then each question with its answer. */
export function questionEventText(event: BotQuestionEvent, t: TFunction): string {
  const line = t(`bots.chat.question.${event.outcome}`, { summary: event.summary });
  const answers = event.answers.map(({ question, answer }) => `- ${question} ${answer}`);
  return [line, ...answers].join('\n');
}
