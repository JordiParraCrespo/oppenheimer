import type { BotFormEvent } from '@oppenheimer/shared/schemas/bot';
import type { TFunction } from 'i18next';

/** A decided form as the export writes it: its line, then each field with what was sent. */
export function formEventText(event: BotFormEvent, t: TFunction): string {
  const line = t(`bots.chat.form.${event.outcome}`, { title: event.title });
  const values = event.values.map(
    ({ label, value }) => `- ${label}: ${value || t('bots.chat.form.blank')}`,
  );
  return [line, ...values].join('\n');
}
