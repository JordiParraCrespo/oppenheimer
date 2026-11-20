import { SettingsHeading, SettingsTitle } from '@oppenheimer/design-system-web';
import { QueryState } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import { BotGatewaysSkeleton } from '@/features/bots/components/bot-gateways-skeleton';
import { BotSlackSkeleton } from '@/features/bots/components/bot-slack-skeleton';
import { BotSlack } from '@/features/bots/sections/bot-slack';
import { BotTelegramGateways } from '@/features/bots/sections/bot-telegram-gateways';
import { BotWhatsappGateways } from '@/features/bots/sections/bot-whatsapp-gateways';

/**
 * `/bots/$botId/settings/gateways`: where people reach the bot. Each WhatsApp
 * number with the groups and people this bot answers there, the Telegram
 * bots it answers on, and its own Slack app, each read on its own.
 */
export function BotGatewaysScreen({ botId }: { botId: string }) {
  const { t } = useTranslation();

  return (
    <>
      <SettingsTitle
        title={t('bots.settings.gateways.title')}
        description={t('bots.settings.gateways.subtitle')}
      />
      <div className="flex flex-col gap-6">
        <QueryState>
          <QueryState.Pending>
            <BotGatewaysSkeleton />
          </QueryState.Pending>
          <QueryState.Error fallback={t('bots.settings.gateways.whatsappFailed')} />
          <QueryState.Data>
            <BotWhatsappGateways botId={botId} />
          </QueryState.Data>
        </QueryState>
        <QueryState>
          <QueryState.Pending>
            <BotGatewaysSkeleton />
          </QueryState.Pending>
          <QueryState.Error fallback={t('bots.settings.gateways.telegramFailed')} />
          <QueryState.Data>
            <BotTelegramGateways botId={botId} />
          </QueryState.Data>
        </QueryState>
        <section data-testid="bot-slack-gateway" className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <SettingsHeading>{t('bots.settings.slack.title')}</SettingsHeading>
            <p className="m-0 px-1 text-sm text-fg-muted">{t('bots.settings.slack.subtitle')}</p>
          </div>
          <QueryState>
            <QueryState.Pending>
              <BotSlackSkeleton />
            </QueryState.Pending>
            <QueryState.Error fallback={t('bots.settings.slack.loadFailed')} />
            <QueryState.Data>
              <BotSlack botId={botId} />
            </QueryState.Data>
          </QueryState>
        </section>
      </div>
    </>
  );
}
