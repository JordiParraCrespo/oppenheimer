import { useSuspenseAutomationsByProject } from '@oppenheimer/frontend-consumer/react';
import { useLocale } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import { SearchChoiceToken } from '../components/search-choice-token';
import { useRunsFilters } from '../hooks/use-runs-filters';
import { automationTriggerText } from '../lib/trigger-text';

const ALL = '__all__';

/**
 * The workspace-wide runs list's Automation and Project facets; an
 * automation's own page has neither, so `RunsTable` renders this only on the
 * Runs tab. It reads the automations and the projects under the same
 * Suspense boundary as the runs (the sidebar has usually read both already).
 */
export function RunsFacets() {
  const { t } = useTranslation();
  const locale = useLocale();
  const filters = useRunsFilters({});
  // A refetch that fails is not drawn here: the facets keep the options they
  // have, and the sidebar beside them says the same read failed.
  const { automations, projects: all } = useSuspenseAutomationsByProject();
  const projects = all.filter((project) => !project.isUnassigned);
  const { state } = filters;
  const automationName = automations.find((row) => row.id === state.automation)?.name;
  const projectName = projects.find((row) => row.id === state.project)?.name;

  return (
    <>
      <SearchChoiceToken
        label={automationName ?? t('automations.runs.allAutomations')}
        value={state.automation ?? ALL}
        dirty={state.automation !== null}
        searchPlaceholder={t('common.search.automations')}
        emptyText={(query) => t('common.search.noMatch', { query })}
        options={[
          { value: ALL, label: t('automations.runs.allAutomations') },
          ...automations.map((automation) => ({
            value: automation.id,
            label: automation.name,
            description: automationTriggerText(automation, locale, t),
          })),
        ]}
        onValueChange={(value) => filters.setAutomation(value === ALL ? null : value)}
      />
      <SearchChoiceToken
        label={projectName ?? t('automations.runs.allProjects')}
        value={state.project ?? ALL}
        dirty={state.project !== null}
        searchPlaceholder={t('common.search.projects')}
        emptyText={(query) => t('common.search.noMatch', { query })}
        options={[
          { value: ALL, label: t('automations.runs.allProjects') },
          ...projects.map((project) => ({ value: project.id, label: project.name })),
        ]}
        onValueChange={(value) => filters.setProject(value === ALL ? null : value)}
      />
    </>
  );
}
