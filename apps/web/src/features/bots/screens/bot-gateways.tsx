import { PillTab, PillTabs, SettingsTitle } from '@oppenheimer/design-system-web';
import { QueryState } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import { BotGatewaysSkeleton } from '@/features/bots/components/bot-gateways-skeleton';
import { BotSlackSkeleton } from '@/features/bots/components/bot-slack-skeleton';
import { useBotGatewaysTab } from '@/features/bots/hooks/use-bot-gateways-tab';
import { BOT_GATEWAY_TABS, type BotGatewayTab } from '@/features/bots/lib/bot-gateways-search';
import { BotSlack } from '@/features/bots/sections/bot-slack';
import { BotTelegramGateways } from '@/features/bots/sections/bot-telegram-gateways';
import { BotWhatsappGateways } from '@/features/bots/sections/bot-whatsapp-gateways';

/**
 * `/bots/$botId/settings/gateways`: where people reach the bot, one tab per
 * channel. WhatsApp: each number with the groups and people this bot answers
 * there. Telegram: the Telegram bots it answers on. Slack: its own Slack app.
 * Only the tab on screen is read.
 */
export function BotGatewaysScreen({ botId }: { botId: string }) {
  const { t } = useTranslation();
  const { tab, setTab } = useBotGatewaysTab();

  return (
    <>
      <SettingsTitle
        title={t('bots.settings.gateways.title')}
        description={t('bots.settings.gateways.subtitle')}
      />
      <PillTabs
        size="sm"
        className="mb-4"
        aria-label={t('bots.settings.gateways.tabs.label')}
        value={tab}
        onValueChange={(next) => setTab(next as BotGatewayTab)}
      >
        {BOT_GATEWAY_TABS.map((id) => (
          <PillTab key={id} value={id} data-testid={`bot-gateway-tab-${id}`}>
            {t(`bots.settings.gateways.tabs.${id}`)}
          </PillTab>
        ))}
      </PillTabs>
      <div className="flex flex-col gap-6">
        {tab === 'whatsapp' ? (
          <QueryState key="whatsapp">
            <QueryState.Pending>
              <BotGatewaysSkeleton />
            </QueryState.Pending>
            <QueryState.Error fallback={t('bots.settings.gateways.whatsappFailed')} />
            <QueryState.Data>
              <BotWhatsappGateways botId={botId} />
            </QueryState.Data>
          </QueryState>
        ) : null}
        {tab === 'telegram' ? (
          <QueryState key="telegram">
            <QueryState.Pending>
              <BotGatewaysSkeleton />
            </QueryState.Pending>
            <QueryState.Error fallback={t('bots.settings.gateways.telegramFailed')} />
            <QueryState.Data>
              <BotTelegramGateways botId={botId} />
            </QueryState.Data>
          </QueryState>
        ) : null}
        {tab === 'slack' ? (
          <section data-testid="bot-slack-gateway" className="flex flex-col gap-3">
            <p className="m-0 px-1 text-sm text-fg-muted">{t('bots.settings.slack.subtitle')}</p>
            <QueryState key="slack">
              <QueryState.Pending>
                <BotSlackSkeleton />
              </QueryState.Pending>
              <QueryState.Error fallback={t('bots.settings.slack.loadFailed')} />
              <QueryState.Data>
                <BotSlack botId={botId} />
              </QueryState.Data>
            </QueryState>
          </section>
        ) : null}
      </div>
    </>
  );
}
