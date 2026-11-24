import type { BotMessageEvent } from '@oppenheimer/shared';
import type { BotFormEntity } from './bot-form.entity';
import { formValuesInWords } from './bot-form-values.policy';
import { BotMessageEntity } from './bot-message.entity';
import { promptText } from './bot-prompt-text.policy';
import { fenceUntrusted } from './bot-tool-text.policy';
import { BotTurnEntity } from './bot-turn.entity';

/**
 * The words around a form (`ask_form`): what the tool answers the model when
 * its form goes up, and the event that opens the turn after the owner
 * submits or dismisses it. The values are the person's words, so the bot
 * reads them fenced, as data.
 */

/** What the model reads when its form went up: its turn should end. */
export function askedForm(fields: number): string {
  return promptText('core/tools-forms.asked-form', {
    fields: fields === 1 ? '1 field' : `${fields} fields`,
  });
}

/** What the model reads when a card of its own still waits: one at a time. */
export function waitingForForm(pendingSummary: string): string {
  return promptText('core/tools-forms.waiting-for-answer', { pendingSummary });
}

/** What the model reads when its form cannot be asked as it stands. */
export function formNotAsked(problem: string): string {
  return promptText('core/tools-forms.form-invalid', { problem });
}

/**
 * A decided form as the event that opens the bot's next turn. The first line
 * is what the chat shows; the values follow fenced, by field id, so a label
 * or a value that spells the fence's closing tag cannot leave it.
 */
export function formEvent(form: BotFormEntity, by: string): string {
  const who = by.trim() || 'The person';
  if (form.status !== 'submitted') {
    return [
      `${who} dismissed your form: ${form.summary}`,
      form.note ? `Their note: ${form.note}` : null,
      promptText('core/wake-forms.dismissed-do-not-ask-again'),
    ]
      .filter(Boolean)
      .join('\n');
  }
  const lines = formValuesInWords(form.spec, form.values)
    .map(({ id, label, value }) => `- ${id} (${label}): ${value === '' ? '(blank)' : value}`)
    .join('\n');
  return [
    `${who} submitted your form: ${form.summary}`,
    promptText('core/wake-forms.values-are-data'),
    fenceUntrusted('values', lines),
  ].join('\n');
}

/** What the chat draws for a decided form, without reading the event's words. */
export function formEventOf(form: BotFormEntity): BotMessageEvent {
  const submitted = form.status === 'submitted';
  return {
    kind: 'form',
    outcome: submitted ? 'submitted' : 'dismissed',
    title: form.summary,
    values: submitted
      ? formValuesInWords(form.spec, form.values).map(({ label, value }) => ({ label, value }))
      : [],
  };
}

/**
 * The turn a decided form gives the bot: queued like a message of yours,
 * opened by the event. Its origin is `question`, the turn a card the person
 * answered opens, whichever kind of card it was.
 */
export function formTurn(
  props: Omit<Parameters<typeof BotTurnEntity.queue>[0], 'origin'>,
  form: BotFormEntity,
  by: string,
): { turn: BotTurnEntity; opening: BotMessageEntity } {
  const turn = BotTurnEntity.queue({ ...props, origin: 'question' });
  const opening = BotMessageEntity.createNew({
    organizationId: props.organizationId,
    botId: props.botId,
    turnId: turn.id,
    role: 'event',
    content: formEvent(form, by),
    event: formEventOf(form),
    steps: [],
    position: 0,
  });
  return { turn, opening };
}
