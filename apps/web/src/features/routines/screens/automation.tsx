import {
  EditorPageBack,
  EmptyState,
  OverviewPage,
  OverviewPageBody,
  PageHeaderCrumbs,
  PageHeaderHere,
} from '@oppenheimer/design-system-web';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

/**
 * One automation (`product/versions/mvp/13-automations.md`): the page header
 * at its large size — the trigger's glyph, the name, Run now, Edit and the
 * more menu, the status line, the paused band — then its run history and
 * its runs. The route and the way back, built ahead of the page: what an
 * automation is comes with the API, so until then the address answers that
 * nothing lives at it.
 */
export function AutomationScreen({ automationId }: { automationId: string }) {
  const { t } = useTranslation();

  return (
    <OverviewPage>
      <OverviewPageBody>
        <EditorPageBack render={<Link to="/automations" />}>
          {t('automations.editor.back')}
        </EditorPageBack>
        <PageHeaderCrumbs>
          <Link to="/automations">{t('automations.detail.crumb')}</Link>
          <span>/</span>
          <PageHeaderHere>{automationId}</PageHeaderHere>
        </PageHeaderCrumbs>
        <EmptyState compact>
          <EmptyState.Header>
            <EmptyState.Description>{t('automations.detail.missing')}</EmptyState.Description>
          </EmptyState.Header>
        </EmptyState>
      </OverviewPageBody>
    </OverviewPage>
  );
}
