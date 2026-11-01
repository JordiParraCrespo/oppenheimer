import { SettingsTitle } from '@oppenheimer/design-system-web';
import { QueryState } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import { BotSkillsSkeleton } from '@/features/bots/components/bot-skills-skeleton';
import { BotSkills } from '@/features/bots/sections/bot-skills';

/**
 * `/bots/$botId/settings/skills`: the bot's skills (`25-bots.md` §4.1), each a
 * way of doing one task the person runs as `/<name>` and the bot uses when a
 * request fits.
 */
export function BotSkillsScreen({ botId }: { botId: string }) {
  const { t } = useTranslation();

  return (
    <>
      <SettingsTitle
        title={t('bots.settings.skills.title')}
        description={t('bots.settings.skills.subtitle')}
      />
      <QueryState>
        <QueryState.Pending>
          <BotSkillsSkeleton />
        </QueryState.Pending>
        <QueryState.Error fallback={t('bots.settings.skills.loadFailed')} />
        <QueryState.Data>
          <BotSkills botId={botId} />
        </QueryState.Data>
      </QueryState>
    </>
  );
}
