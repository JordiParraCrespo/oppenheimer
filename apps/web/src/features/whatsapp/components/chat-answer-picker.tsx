import { FieldSelect } from '@oppenheimer/design-system-web';
import type { BotEntity } from '@oppenheimer/frontend-consumer';
import { useTranslation } from 'react-i18next';

/**
 * Who answers a chat, as a picker: no one, the number's default bot (named
 * when it has one), or one of the reader's bots. Its value is `none`,
 * `default` or a bot's id (`answerValue`).
 */
export function ChatAnswerPicker({
  value,
  onChange,
  bots,
  defaultBotName,
  label,
  disabled,
  withNone = true,
}: {
  value: string;
  onChange: (value: string) => void;
  bots: readonly BotEntity[];
  /** The number's default bot's name; null when it has none, which then answers no one. */
  defaultBotName: string | null;
  label: string;
  disabled?: boolean;
  /** Whether "Not answered" is offered (a bulk "Answer with" offers it as its own button). */
  withNone?: boolean;
}) {
  const { t } = useTranslation();
  const options = [
    ...(withNone ? [{ value: 'none', label: t('settings.whatsapp.chats.none') }] : []),
    {
      value: 'default',
      label: defaultBotName
        ? t('settings.whatsapp.chats.defaultNamed', { bot: defaultBotName })
        : t('settings.whatsapp.chats.defaultNone'),
    },
    ...bots.map((bot) => ({ value: bot.id, label: bot.name })),
  ];
  return (
    <FieldSelect
      variant="quiet"
      aria-label={label}
      value={value}
      options={options}
      placeholder={t('settings.whatsapp.chats.none')}
      searchPlaceholder={t('settings.whatsapp.answering.search')}
      emptyText={() => t('settings.whatsapp.answering.noMatch')}
      disabled={disabled}
      onValueChange={onChange}
    />
  );
}
