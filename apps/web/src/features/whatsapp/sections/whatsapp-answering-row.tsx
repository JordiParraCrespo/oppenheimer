import { FieldSelect, SettingsListRow } from '@oppenheimer/design-system-web';
import type { BotEntity, WhatsappAccountEntity } from '@oppenheimer/frontend-consumer';
import { useAnswerWhatsappAs } from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';

/** The picker's value for "no bot answers here". */
const NO_BOT = '';

/**
 * The bot that answers the reader on one of their numbers by default
 * (`product/next-steps/answering-on-telegram-and-whatsapp.md` §1), or none,
 * saved as it is picked. "Name: …" in the chat switches to another of their
 * bots there; this is the one a chat starts with.
 */
export function WhatsappAnsweringRow({
  account,
  bots,
}: {
  account: WhatsappAccountEntity;
  bots: readonly BotEntity[];
}) {
  const { t } = useTranslation();
  const answer = useAnswerWhatsappAs();

  return (
    <SettingsListRow
      align="center"
      data-testid="whatsapp-answering"
      meta={t(
        account.answeringBotId
          ? 'settings.whatsapp.answering.chosen'
          : 'settings.whatsapp.answering.none',
      )}
      actions={
        <FieldSelect
          variant="quiet"
          aria-label={t('settings.whatsapp.answering.botLabel', { label: account.label })}
          value={account.answeringBotId ?? NO_BOT}
          options={[
            { value: NO_BOT, label: t('settings.whatsapp.answering.noBot') },
            ...bots.map((bot) => ({ value: bot.id, label: bot.name })),
          ]}
          placeholder={t('settings.whatsapp.answering.noBot')}
          searchPlaceholder={t('settings.whatsapp.answering.search')}
          emptyText={() => t('settings.whatsapp.answering.noMatch')}
          disabled={answer.isPending}
          onValueChange={(value) =>
            answer.mutate({ id: account.id, answeringBotId: value === NO_BOT ? null : value })
          }
        />
      }
    >
      {t('settings.whatsapp.answering.title')}
      <ErrorAlert
        error={answer.error}
        fallback={t('settings.whatsapp.answering.failed')}
        onDismiss={answer.reset}
      />
    </SettingsListRow>
  );
}
