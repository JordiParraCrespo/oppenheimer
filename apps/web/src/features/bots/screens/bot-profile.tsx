import {
  SettingsGroup,
  SettingsRow,
  SettingsTitle,
  Skeleton,
} from '@oppenheimer/design-system-web';
import { QueryState } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import { BotProfile } from '@/features/bots/sections/bot-profile';

/** `/bots/$botId/settings/profile`: who the bot is and where it sits in the sidebar. */
export function BotProfileScreen({ botId }: { botId: string }) {
  const { t } = useTranslation();

  return (
    <>
      <SettingsTitle
        title={t('bots.settings.profile.title')}
        description={t('bots.settings.profile.subtitle')}
      />
      <QueryState>
        <QueryState.Pending>
          <SettingsGroup aria-busy>
            {[0, 1, 2].map((row) => (
              <SettingsRow key={row} label={<Skeleton className="h-4 w-28" />}>
                <Skeleton className="h-8 w-40" />
              </SettingsRow>
            ))}
          </SettingsGroup>
        </QueryState.Pending>
        <QueryState.Error fallback={t('bots.settings.loadFailed')} />
        <QueryState.Data>
          <BotProfile botId={botId} />
        </QueryState.Data>
      </QueryState>
    </>
  );
}
