import {
  InlineToken,
  PillTab,
  PillTabs,
  RunRowSkeleton,
  RunsList,
  RunsListFilters,
  RunsListFoot,
  RunsListHead,
  Skeleton,
} from '@oppenheimer/design-system-web';
import { LoadingStatus } from '@oppenheimer/frontend-web';
import type { RunWindow } from '@oppenheimer/shared/automations';
import { useTranslation } from 'react-i18next';
import { RUN_STATUS_TABS, type RunStatusTab } from '../lib/runs-search';

/** As many rows as a page of runs usually shows: enough to stand for it, not a full page to collapse. */
const ROWS = 5;

/**
 * The runs list's place while its first page has not answered, in the
 * list's own card: the status tabs written with their counts as bars, the
 * facets (`facets`, the Runs tab's) at their size, the window as the URL
 * says it, the real column heads, rows on the row's grid and the pager, so
 * the list that replaces it grows by its rows and nothing else moves.
 */
export function RunsSkeleton({
  status,
  window,
  facets = false,
}: {
  status: RunStatusTab;
  window: RunWindow;
  facets?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <RunsList aria-busy>
      <LoadingStatus />
      <RunsListFilters>
        <PillTabs size="sm" value={status} onValueChange={() => {}} disabled>
          {RUN_STATUS_TABS.map((tab) => (
            <PillTab key={tab} value={tab} count={<Skeleton shape="sm" className="h-2 w-3" />}>
              {t(`automations.runs.${tab}`)}
            </PillTab>
          ))}
        </PillTabs>
        <div className="ml-auto flex min-w-0 flex-wrap items-center justify-end gap-2">
          {facets ? (
            <>
              <Skeleton shape="pill" className="h-7 w-32" />
              <Skeleton shape="pill" className="h-7 w-28" />
            </>
          ) : null}
          <InlineToken size="sm" dirty={window !== '30d'} disabled>
            {t(`automations.runs.window.${window}`)}
          </InlineToken>
        </div>
      </RunsListFilters>
      <RunsListHead
        aria-hidden
        columns={[
          t('automations.runs.run'),
          t('automations.runs.automation'),
          t('automations.runs.time'),
        ]}
      />
      {Array.from({ length: ROWS }, (_, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: placeholders have no identity but their place.
        <RunRowSkeleton key={index} index={index} />
      ))}
      <RunsListFoot
        aria-hidden
        range={<Skeleton shape="sm" className="h-2.5 w-20" />}
        previousLabel={t('automations.runs.previous')}
        nextLabel={t('automations.runs.next')}
      />
    </RunsList>
  );
}
