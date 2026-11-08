import { SettingsTitle } from '@oppenheimer/design-system-web';
import { QueryState } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import { BotMemorySkeleton } from '@/features/bots/components/bot-memory-skeleton';
import { PersonAboutSkeleton } from '@/features/bots/components/person-about-skeleton';
import { PersonAbout } from '@/features/bots/sections/person-about';
import { PersonFacts } from '@/features/bots/sections/person-facts';

/**
 * `/settings/memory`: what every bot of the person's knows about them. First
 * what they wrote themselves, which the bots read and never change, then the
 * facts about them the bots learned, each changed on the bot that keeps it.
 * Both read one query, under one boundary.
 */
export function PersonMemoryScreen() {
  const { t } = useTranslation();

  return (
    <>
      <SettingsTitle
        title={t('settings.memory.title')}
        description={t('settings.memory.description')}
      />
      <QueryState>
        <QueryState.Pending>
          <PersonAboutSkeleton />
          <BotMemorySkeleton />
        </QueryState.Pending>
        <QueryState.Error fallback={t('settings.memory.loadFailed')} />
        <QueryState.Data>
          <PersonAbout />
          <PersonFacts />
        </QueryState.Data>
      </QueryState>
    </>
  );
}
