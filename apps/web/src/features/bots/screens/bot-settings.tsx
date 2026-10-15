import { SettingsContent, SettingsMain, Skeleton } from '@oppenheimer/design-system-web';
import { QueryState } from '@oppenheimer/frontend-web';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { BotSettingsNav } from '@/features/bots/sections/bot-settings-nav';
import { BotSettingsTopBar } from '@/features/bots/sections/bot-settings-top-bar';

/**
 * A bot's settings, beside the console's rail: the bar saying whose they are
 * across the top, the pages' list on the left, and the page (`children`, the
 * route's outlet) in Settings' measured column.
 */
export function BotSettingsScreen({ botId, children }: { botId: string; children: ReactNode }) {
  const { t } = useTranslation();

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <QueryState>
        <QueryState.Pending>
          <div className="flex h-14 shrink-0 items-center gap-3 border-b border-border-subtle px-4">
            <Skeleton shape="pill" className="size-7.5" />
            <Skeleton className="h-4 w-32" />
          </div>
        </QueryState.Pending>
        <QueryState.Error fallback={t('bots.settings.loadFailed')} className="m-4" />
        <QueryState.Data>
          <BotSettingsTopBar botId={botId} />
        </QueryState.Data>
      </QueryState>
      <div className="flex min-h-0 flex-1">
        <BotSettingsNav botId={botId} />
        <SettingsMain>
          <SettingsContent>{children}</SettingsContent>
        </SettingsMain>
      </div>
    </div>
  );
}
