import {
  OverviewPage,
  OverviewPageBody,
  RoutineTable,
  RoutineTableEmpty,
  SettingsHeading,
} from '@oppenheimer/design-system-web';
import { Zap } from '@oppenheimer/design-system-web/icons';
import { useTranslation } from 'react-i18next';
import { OverviewTop } from '../sections/overview-top';

/**
 * The automations overview on its Automations tab
 * (`product/versions/mvp/13-automations.md`): the table of the workspace's
 * automations, then the templates. The frame and its blocks, built ahead of
 * the rows: the run history over the table, the rows themselves and the
 * template grid arrive with the API behind them, and until then the table
 * says what an automation is.
 */
export function AutomationsScreen() {
  const { t } = useTranslation();

  return (
    <OverviewPage>
      <OverviewPageBody>
        <OverviewTop tab="automations" />
        <RoutineTable>
          <RoutineTableEmpty>
            <span className="flex size-9 shrink-0 items-center justify-center rounded-pill bg-hover-surface text-fg-muted [&_svg]:size-4">
              <Zap />
            </span>
            <span>{t('automations.page.empty')}</span>
          </RoutineTableEmpty>
        </RoutineTable>
        <section className="mt-4 flex flex-col gap-3">
          <SettingsHeading>{t('automations.page.templates')}</SettingsHeading>
          <p className="m-0 text-sm text-fg-muted">{t('automations.page.templatesEmpty')}</p>
        </section>
      </OverviewPageBody>
    </OverviewPage>
  );
}
