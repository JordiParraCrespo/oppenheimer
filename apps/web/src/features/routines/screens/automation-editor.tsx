import {
  Button,
  EditorPageBack,
  PageHeader,
  PageHeaderCrumbs,
  PageHeaderHere,
  PageHeaderMeta,
  PageHeaderRow,
  PageHeaderTitleInput,
  RoutineStep,
  RoutineSteps,
} from '@oppenheimer/design-system-web';
import { Zap } from '@oppenheimer/design-system-web/icons';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

/**
 * The automation editor (`product/versions/mvp/13-automations.md`): the page
 * over the main column, built like the project page — a page header whose
 * title is the name, Cancel and Create (or Save) on its right, a recap line —
 * then four numbered steps: Where, When, What, Agent. The frame and the
 * steps' names, built ahead of their fields: the pickers, the trigger cards,
 * the task and the agent's controls, and the save itself, arrive with the
 * API behind automations, so the primary stays off and the name is not yet
 * kept.
 *
 * `projectId` is where the sidebar opened it from (`?project=`), which the
 * Where step starts on once it has a project picker; `automationId` is the
 * one being edited.
 */
export function AutomationEditorScreen({
  projectId,
  automationId,
}: {
  projectId?: string;
  automationId?: string;
}) {
  const { t } = useTranslation();
  const editing = automationId !== undefined;

  return (
    <>
      <EditorPageBack render={<Link to="/automations" />}>
        {t('automations.editor.back')}
      </EditorPageBack>

      <PageHeader className="mb-7">
        <PageHeaderCrumbs>
          <Link to="/automations">{t('automations.editor.crumb')}</Link>
          <span>/</span>
          <PageHeaderHere>
            {editing ? t('automations.editor.editTitle') : t('automations.editor.newTitle')}
          </PageHeaderHere>
        </PageHeaderCrumbs>
        <PageHeaderRow
          icon={<Zap />}
          title={
            <PageHeaderTitleInput
              aria-label={t('automations.editor.name')}
              placeholder={t('automations.editor.namePlaceholder')}
              disabled
            />
          }
          actions={
            <>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                render={<Link to="/automations" />}
              >
                {t('common.cancel')}
              </Button>
              <Button type="button" size="sm" disabled>
                {editing ? t('automations.editor.save') : t('automations.editor.create')}
              </Button>
            </>
          }
        />
        <PageHeaderMeta>
          <span>{t('automations.editor.recap')}</span>
        </PageHeaderMeta>
      </PageHeader>

      <RoutineSteps data-project={projectId}>
        <RoutineStep
          number={1}
          title={t('automations.editor.steps.where.title')}
          subtitle={t('automations.editor.steps.where.subtitle')}
        />
        <RoutineStep
          number={2}
          title={t('automations.editor.steps.when.title')}
          subtitle={t('automations.editor.steps.when.subtitle')}
        />
        <RoutineStep
          number={3}
          title={t('automations.editor.steps.what.title')}
          subtitle={t('automations.editor.steps.what.subtitle')}
        />
        <RoutineStep
          number={4}
          title={t('automations.editor.steps.agent.title')}
          subtitle={t('automations.editor.steps.agent.subtitle')}
          last
        />
      </RoutineSteps>
    </>
  );
}
