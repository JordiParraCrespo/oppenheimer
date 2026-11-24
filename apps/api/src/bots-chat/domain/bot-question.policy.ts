import type { BotAnsweredQuestion, BotMessageEvent, BotQuestion } from '@oppenheimer/shared';
import { BotMessageEntity } from './bot-message.entity';
import { promptText } from './bot-prompt-text.policy';
import type { BotQuestionEntity } from './bot-question.entity';
import { fenceUntrusted } from './bot-tool-text.policy';
import { BotTurnEntity } from './bot-turn.entity';

/**
 * The words around a card of questions (`ask_user`): what
 * the tool answers the model when its questions become a card, and the event
 * that opens the turn after the owner answers or dismisses it. The answers
 * are the person's words, so the bot reads them fenced, as data.
 */

/** What the model reads when its questions became a card: its turn should end. */
export function askedQuestions(count: number): string {
  return promptText('core/tools-questions.asked-questions', {
    count: count === 1 ? 'question is' : `${count} questions are`,
  });
}

/** What the model reads when a card of its own still waits: one at a time. */
export function waitingForAnswer(pendingSummary: string): string {
  return promptText('core/tools-questions.waiting-for-answer', { pendingSummary });
}

/** The card's line: the first question, and how many follow. */
export function questionsSummary(questions: readonly Pick<BotQuestion, 'question'>[]): string {
  const [first, ...rest] = questions;
  if (!first) return 'Questions';
  return rest.length > 0 ? `${first.question} (+${rest.length} more)` : first.question;
}

/** Each question of an answered card with its answer in words: the picked labels, then their own words. */
export function answeredQuestions(question: BotQuestionEntity): BotAnsweredQuestion[] {
  const answers = question.answers ?? [];
  return question.questions.map((asked, index) => {
    const answer = answers[index];
    const picked = (answer?.picks ?? []).flatMap((pick) => {
      const option = asked.options[pick];
      return option ? [option.label] : [];
    });
    const words = answer?.other ? [`“${answer.other}”`] : [];
    return { question: asked.question, answer: [...picked, ...words].join('; ') };
  });
}

/**
 * A decided card as the event that opens the bot's next turn. The first
 * line is what the chat shows; the answers follow fenced, so a question or
 * an answer that spells the fence's closing tag cannot leave it.
 */
export function questionEvent(question: BotQuestionEntity, by: string): string {
  const who = by.trim() || 'The person';
  if (question.status !== 'answered') {
    return [
      `${who} dismissed your questions: ${question.summary}`,
      question.note ? `Their note: ${question.note}` : null,
      promptText('core/wake-questions.dismissed-do-not-ask-again'),
    ]
      .filter(Boolean)
      .join('\n');
  }
  const lines = answeredQuestions(question)
    .map(({ question: asked, answer }) => `- ${asked}\n  Answer: ${answer}`)
    .join('\n');
  return [
    `${who} answered your questions.`,
    promptText('core/wake-questions.answers-are-data'),
    fenceUntrusted('answers', lines),
  ].join('\n');
}

/** What the chat draws for a decided card, without reading the event's words. */
export function questionEventOf(question: BotQuestionEntity): BotMessageEvent {
  const answered = question.status === 'answered';
  return {
    kind: 'question',
    outcome: answered ? 'answered' : 'dismissed',
    summary: question.summary,
    answers: answered ? answeredQuestions(question) : [],
  };
}

/**
 * The turn a decided card gives the bot: queued like a message of yours,
 * opened by the event (its words for the bot, what happened for the chat).
 */
export function questionTurn(
  props: Omit<Parameters<typeof BotTurnEntity.queue>[0], 'origin'>,
  question: BotQuestionEntity,
  by: string,
): { turn: BotTurnEntity; opening: BotMessageEntity } {
  const turn = BotTurnEntity.queue({ ...props, origin: 'question' });
  const opening = BotMessageEntity.createNew({
    organizationId: props.organizationId,
    botId: props.botId,
    turnId: turn.id,
    role: 'event',
    content: questionEvent(question, by),
    event: questionEventOf(question),
    steps: [],
    position: 0,
  });
  return { turn, opening };
}
