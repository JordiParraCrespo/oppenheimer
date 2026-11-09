import { Button, FieldSelect, SettingsListRow } from '@oppenheimer/design-system-web';
import { ExternalLink } from '@oppenheimer/design-system-web/icons';
import type { BotEntity, TelegramAccountEntity } from '@oppenheimer/frontend-consumer';
import {
  useAnswerTelegramAs,
  useOpenTelegramOwnerLink,
} from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';

/** The picker's value for "no bot answers here". */
const NO_BOT = '';

/**
 * Who answers the reader on one of their Telegram bots
 * (`product/next-steps/answering-on-telegram-and-whatsapp.md`): the bot that
 * answers there, or none, saved as it is picked; and the one-time link that
 * records the reader's own Telegram account as the owner, the only person it
 * answers. The link is made on request and opened from here, so its code is
 * never shown; it lasts ten minutes, and New link makes another when it has
 * expired or been used.
 */
export function TelegramAnsweringRow({
  account,
  bots,
}: {
  account: TelegramAccountEntity;
  bots: readonly BotEntity[];
}) {
  const { t } = useTranslation();
  const answer = useAnswerTelegramAs();
  const ownerLink = useOpenTelegramOwnerLink();
  const failed = answer.error ?? ownerLink.error;
  const meta = ownerLink.data
    ? t('settings.telegram.answering.linkReady')
    : account.ownerLinked
      ? t('settings.telegram.answering.linked')
      : t('settings.telegram.answering.notLinked');

  return (
    <SettingsListRow
      align="center"
      data-testid="telegram-answering"
      meta={meta}
      actions={
        <>
          <FieldSelect
            variant="quiet"
            aria-label={t('settings.telegram.answering.botLabel', { label: account.label })}
            value={account.answeringBotId ?? NO_BOT}
            options={[
              { value: NO_BOT, label: t('settings.telegram.answering.noBot') },
              ...bots.map((bot) => ({ value: bot.id, label: bot.name })),
            ]}
            placeholder={t('settings.telegram.answering.noBot')}
            searchPlaceholder={t('settings.telegram.answering.search')}
            emptyText={() => t('settings.telegram.answering.noMatch')}
            disabled={answer.isPending}
            onValueChange={(value) =>
              answer.mutate({ id: account.id, answeringBotId: value === NO_BOT ? null : value })
            }
          />
          {ownerLink.data ? (
            <Button
              size="sm"
              variant="primary"
              nativeButton={false}
              render={<a href={ownerLink.data.url} target="_blank" rel="noopener noreferrer" />}
            >
              <ExternalLink />
              {t('settings.telegram.answering.openLink')}
            </Button>
          ) : null}
          {account.username && !account.needsToken ? (
            <Button
              size="sm"
              variant={account.ownerLinked || ownerLink.data ? 'ghost' : 'secondary'}
              pending={ownerLink.isPending}
              pendingLabel={t('settings.telegram.answering.making')}
              onClick={() => ownerLink.mutate(account.id)}
            >
              {ownerLink.data ? null : <ExternalLink />}
              {t(
                ownerLink.data
                  ? 'settings.telegram.answering.newLink'
                  : account.ownerLinked
                    ? 'settings.telegram.answering.linkAgain'
                    : 'settings.telegram.answering.link',
              )}
            </Button>
          ) : null}
        </>
      }
    >
      {t('settings.telegram.answering.title')}
      <ErrorAlert
        error={failed}
        fallback={t('settings.telegram.answering.failed')}
        onDismiss={() => {
          answer.reset();
          ownerLink.reset();
        }}
      />
    </SettingsListRow>
  );
}
