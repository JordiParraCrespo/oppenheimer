import {
  Button,
  EditorPageBack,
  PageHeader,
  PageHeaderCrumbs,
  PageHeaderHere,
  PageHeaderMeta,
  PageHeaderRow,
  PageHeaderTitleInput,
} from '@oppenheimer/design-system-web';
import { Zap } from '@oppenheimer/design-system-web/icons';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

/**
 * New automation (`product/versions/mvp/13-automations.md`): the page over
 * the main column, opened like the project page — the Back pill, a page
 * header whose title is the name, Cancel and Create on its right, a recap
 * line. The steps under it, the fields in them and the save arrive with the
 * API, so the primary stays off and the name is not yet kept.
 */
export function AutomationEditorScreen() {
  const { t } = useTranslation();

  return (
    <>
      <EditorPageBack render={<Link to="/automations" />}>
        {t('automations.editor.back')}
      </EditorPageBack>

      <PageHeader className="mb-7">
        <PageHeaderCrumbs>
          <Link to="/automations">{t('automations.editor.crumb')}</Link>
          <span>/</span>
          <PageHeaderHere>{t('automations.editor.newTitle')}</PageHeaderHere>
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
                {t('automations.editor.create')}
              </Button>
            </>
          }
        />
        <PageHeaderMeta>
          <span>{t('automations.editor.recap')}</span>
        </PageHeaderMeta>
      </PageHeader>
    </>
  );
}
