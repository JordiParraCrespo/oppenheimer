import {
  PillTab,
  PillTabs,
  SettingsGroup,
  SettingsHeading,
  SettingsListRow,
} from '@oppenheimer/design-system-web';
import {
  useSetBotToolDecision,
  useSuspenseBotPermissions,
} from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert } from '@oppenheimer/frontend-web';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BotToolGroup } from '@/features/bots/components/bot-tool-group';
import { BotToolRow } from '@/features/bots/components/bot-tool-row';
import { ToolSearchField } from '@/features/bots/components/tool-search-field';
import { useToolView } from '@/features/bots/hooks/use-tool-view';
import {
  countToolViews,
  filterToolGroups,
  isFiltering,
  summarizeToolGroup,
  TOOL_VIEWS,
  type ToolView,
} from '@/features/bots/lib/tool-filter';

/**
 * Every tool the bot has, under its group: what each does on its own. A tool
 * nobody set follows the preset (Approve for me asks before anything that
 * reaches outside Oppenheimer; Full access runs it).
 *
 * The list is long, so it opens folded: one line per group saying how its
 * tools stand. A search over names and sentences, and a view per decision (or
 * the tools you set), narrow it; a narrowed list opens every group that still
 * has a tool. The whole catalog arrives in one read, so the filter runs here.
 */
export function BotToolPermissions({ botId }: { botId: string }) {
  const { t } = useTranslation();
  const { data: permissions, error } = useSuspenseBotPermissions(botId);
  const decide = useSetBotToolDecision();
  const [query, setQuery] = useState('');
  const { view, setView } = useToolView();

  const filter = { query, view };
  const filtering = isFiltering(filter);
  const counts = countToolViews(permissions.tools, query);
  const groups = filterToolGroups(permissions.groups, filter);

  const summaryOf = (tools: Parameters<typeof summarizeToolGroup>[0]) => {
    const summary = summarizeToolGroup(tools);
    return [
      t('bots.settings.permissions.summary.tools', { count: summary.total }),
      summary.ask ? t('bots.settings.permissions.summary.ask', { count: summary.ask }) : null,
      summary.off ? t('bots.settings.permissions.summary.off', { count: summary.off }) : null,
      summary.changed
        ? t('bots.settings.permissions.summary.changed', { count: summary.changed })
        : null,
    ]
      .filter(Boolean)
      .join(' · ');
  };

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
      <div className="flex flex-wrap items-center gap-2 px-1">
        <ToolSearchField label={t('bots.settings.permissions.search')} onChange={setQuery} />
        <PillTabs
          size="sm"
          value={view}
          onValueChange={(next) => setView(next as ToolView)}
          aria-label={t('bots.settings.permissions.views.label')}
        >
          {TOOL_VIEWS.map((option) => (
            <PillTab key={option} value={option} count={counts[option]}>
              {t(`bots.settings.permissions.views.${option}`)}
            </PillTab>
          ))}
        </PillTabs>
      </div>
      {groups.length === 0 ? (
        <SettingsGroup>
          <SettingsListRow muted>{t('bots.settings.permissions.noMatch')}</SettingsListRow>
        </SettingsGroup>
      ) : (
        <div className="flex flex-col gap-1">
          {groups.map(({ group, tools }) => (
            <BotToolGroup
              key={`${group}:${filtering}`}
              label={t(`bots.settings.permissions.groups.${group}`)}
              summary={summaryOf(tools)}
              defaultOpen={filtering}
            >
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
            </BotToolGroup>
          ))}
        </div>
      )}
    </section>
  );
}
