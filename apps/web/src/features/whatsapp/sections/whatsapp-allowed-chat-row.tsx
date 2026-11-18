import { Button, FieldSelect, SettingsListRow } from '@oppenheimer/design-system-web';
import type { BotEntity, WhatsappChatGrantEntity } from '@oppenheimer/frontend-consumer';
import {
  useAnswerWhatsappChatAs,
  useRevokeWhatsappChat,
} from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';

/** The picker's value for "the number's default bot". */
const DEFAULT_BOT = '';

/**
 * One group or person a number allows: whether it is a group, who allowed it
 * (a bot, in the reader's own chat, or Settings), the bot that answers there,
 * saved as it is picked, and Remove, which stops allowing it at once.
 */
export function WhatsappAllowedChatRow({
  grant,
  bots,
  allowedBy,
}: {
  grant: WhatsappChatGrantEntity;
  bots: readonly BotEntity[];
  /** The name of the bot that allowed it; null when allowed in Settings or that bot is gone. */
  allowedBy: string | null;
}) {
  const { t } = useTranslation();
  const answer = useAnswerWhatsappChatAs();
  const revoke = useRevokeWhatsappChat();
  const meta = [
    t(grant.isGroup ? 'settings.whatsapp.allowed.group' : 'settings.whatsapp.allowed.person'),
    allowedBy
      ? t('settings.whatsapp.allowed.allowedBy', { bot: allowedBy })
      : grant.grantedByBotId
        ? t('settings.whatsapp.allowed.allowedByRemovedBot')
        : t('settings.whatsapp.allowed.allowedInSettings'),
  ].join(' · ');

  return (
    <SettingsListRow
      align="center"
      data-testid="whatsapp-allowed-chat"
      meta={meta}
      actions={
        <>
          <FieldSelect
            variant="quiet"
            aria-label={t('settings.whatsapp.allowed.botLabel', { chat: grant.title })}
            value={grant.botId ?? DEFAULT_BOT}
            options={[
              { value: DEFAULT_BOT, label: t('settings.whatsapp.allowed.defaultBot') },
              ...bots.map((bot) => ({ value: bot.id, label: bot.name })),
            ]}
            placeholder={t('settings.whatsapp.allowed.defaultBot')}
            searchPlaceholder={t('settings.whatsapp.answering.search')}
            emptyText={() => t('settings.whatsapp.answering.noMatch')}
            disabled={answer.isPending || revoke.isPending}
            onValueChange={(value) =>
              answer.mutate({
                accountId: grant.accountId,
                grantId: grant.id,
                botId: value === DEFAULT_BOT ? null : value,
              })
            }
          />
          <Button
            size="sm"
            variant="ghost"
            pending={revoke.isPending}
            aria-label={t('settings.whatsapp.allowed.removeLabel', { chat: grant.title })}
            onClick={() => revoke.mutate({ accountId: grant.accountId, grantId: grant.id })}
          >
            {t('settings.whatsapp.allowed.remove')}
          </Button>
        </>
      }
    >
      {grant.title}
      <ErrorAlert
        error={answer.error ?? revoke.error}
        fallback={t(
          revoke.error
            ? 'settings.whatsapp.allowed.removeFailed'
            : 'settings.whatsapp.answering.failed',
        )}
        onDismiss={() => {
          answer.reset();
          revoke.reset();
        }}
      />
    </SettingsListRow>
  );
}
