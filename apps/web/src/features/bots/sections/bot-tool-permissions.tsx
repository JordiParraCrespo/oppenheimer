import {
  FacetSelect,
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
import { useToolFilter } from '@/features/bots/hooks/use-tool-filter';
import { deriveToolList, summarizeToolGroup } from '@/features/bots/lib/tool-filter';
import { TOOL_VIEWS, toToolView } from '@/features/bots/lib/tool-search';

/**
 * Every tool the bot has, under its group: what each does on its own. A tool
 * nobody set follows the preset (Approve for me asks before anything that
 * reaches outside Oppenheimer; Full access runs it).
 *
 * The list is long, so it opens folded: one line per group saying how its
 * tools stand. A search over names and sentences, and two dropdowns, the
 * decision (or the tools you set) and the group, narrow it, each option with
 * the count it would leave; a narrowed list opens every group that still has
 * a tool. The whole catalog arrives in one read, so the filter runs here.
 */
export function BotToolPermissions({ botId }: { botId: string }) {
  const { t } = useTranslation();
  const { data: permissions, error } = useSuspenseBotPermissions(botId);
  const decide = useSetBotToolDecision();
  const { filter, setQuery, setView, setGroup, clear } = useToolFilter();

  const list = deriveToolList(permissions.groups, filter);
  // Clear empties the field too: a new key drops its half-typed word and the
  // search still waiting on its debounce, which would otherwise land after.
  const [cleared, setCleared] = useState(0);

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
        <ToolSearchField
          key={cleared}
          label={t('bots.settings.permissions.search')}
          value={filter.query}
          onChange={setQuery}
        />
        <FacetSelect
          label={t('bots.settings.permissions.filters.decision')}
          value={filter.view}
          onValueChange={(next) => setView(toToolView(next))}
          options={TOOL_VIEWS.map((view) => ({
            value: view,
            label: t(`bots.settings.permissions.views.${view}`),
            count: list.views[view],
          }))}
        />
        <FacetSelect
          label={t('bots.settings.permissions.filters.group')}
          value={list.group}
          onValueChange={setGroup}
          menuWidth={260}
          options={[
            {
              value: 'all',
              label: t('bots.settings.permissions.filters.allGroups'),
              count: list.groupCounts.all,
            },
            ...permissions.groups.map(({ group }) => ({
              value: group,
              label: t(`bots.settings.permissions.groups.${group}`),
              count: list.groupCounts[group],
            })),
          ]}
        />
        {list.filtering ? (
          <button
            type="button"
            onClick={() => {
              clear();
              setCleared((count) => count + 1);
            }}
            className="ml-1 text-sm text-fg-muted transition-colors duration-fast hover:text-fg"
          >
            {t('bots.settings.permissions.filters.clear')}
          </button>
        ) : null}
      </div>
      {list.groups.length === 0 ? (
        <SettingsGroup>
          <SettingsListRow muted>{t('bots.settings.permissions.noMatch')}</SettingsListRow>
        </SettingsGroup>
      ) : (
        <div className="flex flex-col gap-1">
          {list.groups.map(({ group, tools }) => (
            <BotToolGroup
              key={group}
              label={t(`bots.settings.permissions.groups.${group}`)}
              summary={summaryOf(tools)}
              filtering={list.filtering}
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
