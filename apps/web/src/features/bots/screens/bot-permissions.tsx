import { SettingsTitle } from '@oppenheimer/design-system-web';
import { QueryState } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import { BotPermissionsSkeleton } from '@/features/bots/components/bot-permissions-skeleton';
import { BotPermissionRules } from '@/features/bots/sections/bot-permission-rules';
import { BotToolGrants } from '@/features/bots/sections/bot-tool-grants';
import { BotToolPermissions } from '@/features/bots/sections/bot-tool-permissions';

/**
 * `/bots/$botId/settings/permissions`: what the bot may do on its own
 * (`25-bots.md` §5). Each tool's Allow, Ask or Off over the preset, what a
 * yes left standing, and the rules a reviewer reads before an asking call.
 * The three read one answer, so they wait on one boundary.
 */
export function BotPermissionsScreen({ botId }: { botId: string }) {
  const { t } = useTranslation();

  return (
    <>
      <SettingsTitle
        title={t('bots.settings.permissions.title')}
        description={t('bots.settings.permissions.subtitle')}
      />
      <QueryState>
        <QueryState.Pending>
          <BotPermissionsSkeleton />
        </QueryState.Pending>
        <QueryState.Error fallback={t('bots.settings.permissions.loadFailed')} />
        <QueryState.Data>
          <BotPermissionRules botId={botId} effect="ask" />
          <BotPermissionRules botId={botId} effect="allow" />
          <BotToolGrants botId={botId} />
          <BotToolPermissions botId={botId} />
        </QueryState.Data>
      </QueryState>
    </>
  );
}
