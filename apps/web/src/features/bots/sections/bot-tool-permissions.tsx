import { SettingsGroup, SettingsHeading } from '@oppenheimer/design-system-web';
import {
  useSetBotToolDecision,
  useSuspenseBotPermissions,
} from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import { BotToolRow } from '@/features/bots/components/bot-tool-row';

/**
 * Every tool the bot has, under its group: what each does on its own. A tool
 * nobody set follows the preset (Approve for me asks before anything that
 * reaches outside Oppenheimer; Full access runs it).
 */
export function BotToolPermissions({ botId }: { botId: string }) {
  const { t } = useTranslation();
  const { data: permissions, error } = useSuspenseBotPermissions(botId);
  const decide = useSetBotToolDecision();

  return (
    <section className="flex flex-col gap-2.5">
      <SettingsHeading>{t('bots.settings.permissions.tools')}</SettingsHeading>
      <p className="m-0 px-1 text-sm text-fg-muted">
        {t(`bots.settings.permissions.preset.${permissions.preset}`)}
      </p>
      <ErrorAlert error={error} fallback={t('bots.settings.permissions.loadFailed')} />
      <ErrorAlert
        error={decide.error}
        fallback={t('bots.settings.permissions.saveFailed')}
        onDismiss={() => decide.reset()}
      />
      {permissions.groups.map(({ group, tools }) => (
        <div key={group} className="flex flex-col gap-1.5">
          <h3 className="eyebrow m-0 px-1">{t(`bots.settings.permissions.groups.${group}`)}</h3>
          <SettingsGroup>
            {tools.map((tool) => (
              <BotToolRow
                key={tool.name}
                tool={tool}
                pending={decide.isPending && decide.variables?.tool === tool.name}
                onDecide={(decision) => decide.mutate({ id: botId, tool: tool.name, decision })}
              />
            ))}
          </SettingsGroup>
        </div>
      ))}
    </section>
  );
}
