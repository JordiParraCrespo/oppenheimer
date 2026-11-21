import { useSuspenseWhatsappSettings } from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert, QueryState } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import { BotGatewaysSkeleton } from '@/features/bots/components/bot-gateways-skeleton';
import { BotWhatsappNumber } from '@/features/bots/sections/bot-whatsapp-number';

/**
 * The reader's WhatsApp numbers that can route chats to this bot (connected,
 * with the owner's own number confirmed), one card each, each card reading
 * its chats on its own. A line says so when there is none.
 */
export function BotWhatsappGateways({ botId }: { botId: string }) {
  const { t } = useTranslation();
  const { accounts, bots, error } = useSuspenseWhatsappSettings();
  const usable = accounts.filter(
    (account) => account.status === 'connected' && account.ownerNumber,
  );

  if (usable.length === 0) {
    return (
      <p className="m-0 px-1 text-sm text-fg-muted">{t('bots.settings.gateways.noWhatsapp')}</p>
    );
  }

  return (
    <>
      <ErrorAlert error={error} fallback={t('bots.settings.gateways.whatsappFailed')} />
      {usable.map((account) => (
        <QueryState key={account.id}>
          <QueryState.Pending>
            <BotGatewaysSkeleton />
          </QueryState.Pending>
          <QueryState.Error fallback={t('bots.settings.gateways.chatsFailed')} />
          <QueryState.Data>
            <BotWhatsappNumber botId={botId} account={account} bots={bots} />
          </QueryState.Data>
        </QueryState>
      ))}
    </>
  );
}
