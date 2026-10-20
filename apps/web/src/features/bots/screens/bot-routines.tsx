import { SettingsTitle } from '@oppenheimer/design-system-web';
import { QueryState } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import { BotRoutinesSkeleton } from '@/features/bots/components/bot-routines-skeleton';
import { BotRoutines } from '@/features/bots/sections/bot-routines';

/**
 * `/bots/$botId/settings/routines` (`26-bot-routines.md` §7): what the bot
 * does on its own, on a schedule or when something happens. The chat is
 * where a routine is made and changed; this page turns one on or off, runs
 * it now or deletes it.
 */
export function BotRoutinesScreen({ botId }: { botId: string }) {
  const { t } = useTranslation();

  return (
    <>
      <SettingsTitle
        title={t('bots.settings.routines.title')}
        description={t('bots.settings.routines.subtitle')}
      />
      <QueryState>
        <QueryState.Pending>
          <BotRoutinesSkeleton />
        </QueryState.Pending>
        <QueryState.Error fallback={t('bots.settings.routines.loadFailed')} />
        <QueryState.Data>
          <BotRoutines botId={botId} />
        </QueryState.Data>
      </QueryState>
    </>
  );
}
