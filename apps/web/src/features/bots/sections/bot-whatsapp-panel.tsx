import { QueryState } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import { BotGatewaysSkeleton } from '@/features/bots/components/bot-gateways-skeleton';
import { BotWhatsappGateways } from '@/features/bots/sections/bot-whatsapp-gateways';

/** Each WhatsApp number this bot can answer on, with the chats it answers there. */
export function BotWhatsappPanel({ botId }: { botId: string }) {
  const { t } = useTranslation();
  return (
    <QueryState>
      <QueryState.Pending>
        <BotGatewaysSkeleton />
      </QueryState.Pending>
      <QueryState.Error fallback={t('bots.settings.gateways.whatsappFailed')} />
      <QueryState.Data>
        <BotWhatsappGateways botId={botId} />
      </QueryState.Data>
    </QueryState>
  );
}
