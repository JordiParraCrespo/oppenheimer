import {
  SettingsGroup,
  SettingsRow,
  SettingsTitle,
  Skeleton,
} from '@oppenheimer/design-system-web';
import { QueryState } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import { BotMemorySkeleton } from '@/features/bots/components/bot-memory-skeleton';
import { BotLearning } from '@/features/bots/sections/bot-learning';
import { BotMemory } from '@/features/bots/sections/bot-memory';

/**
 * `/bots/$botId/settings/memory`: what the bot remembers between chats.
 * Learn automatically reads the bot and the facts read its memory, each
 * under its own boundary, so neither waits on the other.
 */
export function BotMemoryScreen({ botId }: { botId: string }) {
  const { t } = useTranslation();

  return (
    <>
      <SettingsTitle
        title={t('bots.settings.memory.title')}
        description={t('bots.settings.memory.subtitle')}
      />
      <QueryState>
        <QueryState.Pending>
          <SettingsGroup aria-busy>
            <SettingsRow label={<Skeleton className="h-4 w-36" />} />
          </SettingsGroup>
        </QueryState.Pending>
        <QueryState.Error fallback={t('bots.settings.loadFailed')} />
        <QueryState.Data>
          <BotLearning botId={botId} />
        </QueryState.Data>
      </QueryState>
      <QueryState>
        <QueryState.Pending>
          <BotMemorySkeleton />
        </QueryState.Pending>
        <QueryState.Error fallback={t('bots.settings.memory.loadFailed')} />
        <QueryState.Data>
          <BotMemory botId={botId} />
        </QueryState.Data>
      </QueryState>
    </>
  );
}
