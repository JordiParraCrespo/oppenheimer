import { PillTab, PillTabs, SettingsTitle } from '@oppenheimer/design-system-web';
import { QueryState } from '@oppenheimer/frontend-web';
import type { ComponentType } from 'react';
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
  const Panel = GATEWAY_PANELS[tab];

  return (
    <>
      <SettingsTitle
        title={t('bots.settings.gateways.title')}
        description={t('bots.settings.gateways.subtitle')}
      />
      <div className="flex flex-col gap-4">
        <PillTabs
          size="sm"
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
          <Panel key={tab} botId={botId} />
        </div>
      </div>
    </>
  );
}

/** Each WhatsApp number this bot can answer on, with the chats it answers there. */
function WhatsappPanel({ botId }: { botId: string }) {
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

/** The Telegram bots this bot answers on. */
function TelegramPanel({ botId }: { botId: string }) {
  const { t } = useTranslation();
  return (
    <QueryState>
      <QueryState.Pending>
        <BotGatewaysSkeleton />
      </QueryState.Pending>
      <QueryState.Error fallback={t('bots.settings.gateways.telegramFailed')} />
      <QueryState.Data>
        <BotTelegramGateways botId={botId} />
      </QueryState.Data>
    </QueryState>
  );
}

/** The bot's own Slack app: what it does, then its setup or its connection. */
function SlackPanel({ botId }: { botId: string }) {
  const { t } = useTranslation();
  return (
    <section data-testid="bot-slack-gateway" className="flex flex-col gap-3">
      <p className="m-0 px-1 text-sm text-fg-muted">{t('bots.settings.slack.subtitle')}</p>
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
  );
}

/** One panel per tab; a new gateway is a tab id, a panel and a line here. */
const GATEWAY_PANELS: Record<BotGatewayTab, ComponentType<{ botId: string }>> = {
  whatsapp: WhatsappPanel,
  telegram: TelegramPanel,
  slack: SlackPanel,
};
