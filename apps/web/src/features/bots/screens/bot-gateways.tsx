import { PillTab, PillTabs, SettingsTitle } from '@oppenheimer/design-system-web';
import type { ComponentType } from 'react';
import { useTranslation } from 'react-i18next';
import { useBotGatewaysTab } from '@/features/bots/hooks/use-bot-gateways-tab';
import { BOT_GATEWAY_TABS, type BotGatewayTab } from '@/features/bots/lib/bot-gateways-search';
import { BotSlackPanel } from '@/features/bots/sections/bot-slack-panel';
import { BotTelegramPanel } from '@/features/bots/sections/bot-telegram-panel';
import { BotWhatsappPanel } from '@/features/bots/sections/bot-whatsapp-panel';

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

/** One panel per tab; a new gateway is a tab id, a panel and a line here. */
const GATEWAY_PANELS: Record<BotGatewayTab, ComponentType<{ botId: string }>> = {
  whatsapp: BotWhatsappPanel,
  telegram: BotTelegramPanel,
  slack: BotSlackPanel,
};
