import { SettingsListRow } from '@oppenheimer/design-system-web';
import type { BotEntity, WhatsappAccountEntity } from '@oppenheimer/frontend-consumer';
import { useSuspenseWhatsappChatGrants } from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import { WhatsappAllowedChatRow } from '@/features/whatsapp/sections/whatsapp-allowed-chat-row';

/**
 * The chats a number allows besides the reader's own: a heading row that
 * says how many and how one is added (by asking a bot in the reader's own
 * chat), then one row per group or person with the bot that answers there.
 */
export function WhatsappAllowedChatsList({
  account,
  bots,
}: {
  account: WhatsappAccountEntity;
  bots: readonly BotEntity[];
}) {
  const { t } = useTranslation();
  const { data: grants, error } = useSuspenseWhatsappChatGrants(account.id);
  const botNames = new Map(bots.map((bot) => [bot.id, bot.name]));

  return (
    <>
      <SettingsListRow
        align="center"
        data-testid="whatsapp-allowed-chats"
        meta={
          grants.length === 0
            ? t('settings.whatsapp.allowed.none')
            : t('settings.whatsapp.allowed.some', { count: grants.length })
        }
      >
        {t('settings.whatsapp.allowed.title')}
        <ErrorAlert error={error} fallback={t('settings.whatsapp.allowed.loadFailed')} />
      </SettingsListRow>
      {grants.map((grant) => (
        <WhatsappAllowedChatRow
          key={grant.id}
          grant={grant}
          bots={bots}
          allowedBy={grant.grantedByBotId ? (botNames.get(grant.grantedByBotId) ?? null) : null}
        />
      ))}
    </>
  );
}
