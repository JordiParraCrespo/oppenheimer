import {
  Button,
  EmptyState,
  ProjectMilestoneRow,
  ProjectOverview,
  ProjectOverviewColumn,
  ProjectPanel,
  ProjectPanelEmpty,
  ProjectTaskRow,
} from '@oppenheimer/design-system-web';
import { useSuspensePlan } from '@oppenheimer/frontend-consumer/react';
import { dateFormatter, ErrorAlert, useLocale } from '@oppenheimer/frontend-web';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { dayOf, planProjectParam } from '../lib/project-links';
import { projectTaskGroups } from '../lib/project-list';

/**
 * A project's page under Plan's Projects: its milestones with how far each
 * is, the tasks that wait on a person and the ones in progress. A milestone
 * opens Milestones narrowed to the project, a task its dialog on the board.
 * It reads under Suspense, in the screen's `QueryState`; a refetch that fails
 * keeps the panels and says so above them. A project that is gone says so.
 */
export function ProjectOverviewSection({ projectId }: { projectId: string }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const { tasks, projects, milestones, error } = useSuspensePlan();
  const project = projects.find((row) => row.id === projectId);

  if (!project) {
    return (
      <EmptyState>
        <EmptyState.Header>
          <EmptyState.Description>{t('projects.detail.gone')}</EmptyState.Description>
        </EmptyState.Header>
        <EmptyState.Content>
          <Button variant="secondary" render={<Link to="/plan/projects" />}>
            {t('projects.detail.back')}
          </Button>
        </EmptyState.Content>
      </EmptyState>
    );
  }

  const own = milestones.filter((milestone) => milestone.projectId === projectId);
  const { blocked, doing } = projectTaskGroups(projectId, tasks);
  const due = dateFormatter(locale, { month: 'short', day: 'numeric' });
  const dueOf = (iso: string | null) => (iso ? due.format(dayOf(iso)) : undefined);
  const scope = { project: planProjectParam(project) };

  return (
    <>
      <ErrorAlert error={error} fallback={t('projects.detail.loadFailed')} />
      <ProjectOverview>
        <ProjectOverviewColumn>
          <ProjectPanel label={t('projects.detail.milestones')}>
            {own.length === 0 ? (
              <ProjectPanelEmpty>{t('projects.detail.noMilestones')}</ProjectPanelEmpty>
            ) : (
              own.map((milestone) => (
                <ProjectMilestoneRow
                  key={milestone.id}
                  name={milestone.name}
                  done={milestone.doneCount}
                  total={milestone.totalCount}
                  render={<Link to="/plan" search={{ ...scope, milestone: milestone.id }} />}
                />
              ))
            )}
          </ProjectPanel>
        </ProjectOverviewColumn>
        <ProjectOverviewColumn>
          {blocked.length > 0 ? (
            <ProjectPanel label={t('projects.detail.needsInput')}>
              {blocked.map((task) => (
                <ProjectTaskRow
                  key={task.id}
                  state="needs-input"
                  reason={task.blockedReason}
                  title={task.title}
                  due={dueOf(task.dueDate)}
                  render={<Link to="/plan" search={{ ...scope, task: task.id }} />}
                />
              ))}
            </ProjectPanel>
          ) : null}
          <ProjectPanel label={t('projects.detail.inProgress')}>
            {doing.length === 0 ? (
              <ProjectPanelEmpty>{t('projects.detail.nothingInProgress')}</ProjectPanelEmpty>
            ) : (
              doing.map((task) => (
                <ProjectTaskRow
                  key={task.id}
                  state="running"
                  title={task.title}
                  due={dueOf(task.dueDate)}
                  render={<Link to="/plan" search={{ ...scope, task: task.id }} />}
                />
              ))
            )}
          </ProjectPanel>
        </ProjectOverviewColumn>
      </ProjectOverview>
    </>
  );
}
