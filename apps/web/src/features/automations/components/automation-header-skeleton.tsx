import {
  Button,
  IconButton,
  PageHeader,
  PageHeaderMeta,
  PageHeaderRow,
  PageHeaderSep,
  Skeleton,
} from '@oppenheimer/design-system-web';
import { Ellipsis, Play } from '@oppenheimer/design-system-web/icons';
import { LoadingStatus } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';

/**
 * An automation's header before the automation answers, on `AutomationHeader`'s
 * own parts: the glyph's slot, the title as a bar at the heading's line, Run now, Edit and
 * the ellipsis drawn disabled, and the facts as bars on the meta line.
 */
export function AutomationHeaderSkeleton() {
  const { t } = useTranslation();
  return (
    <PageHeader aria-busy>
      <LoadingStatus />
      <PageHeaderRow
        icon={<Skeleton shape="pill" className="size-4" />}
        title={
          <span className="wrap-lead flex h-7.5 items-center">
            <Skeleton shape="sm" className="h-5 w-56 max-w-full" />
          </span>
        }
        actions={
          <>
            <Button variant="secondary" size="sm" disabled>
              <Play />
              {t('automations.detail.runNow')}
            </Button>
            <Button variant="secondary" size="sm" disabled>
              {t('automations.detail.edit')}
            </Button>
            <IconButton aria-label={t('automations.detail.more')} size="sm" disabled>
              <Ellipsis />
            </IconButton>
          </>
        }
      />
      <PageHeaderMeta aria-hidden>
        <span className="flex h-5 items-center gap-1.5">
          <Skeleton shape="pill" className="size-1.5" />
          <Skeleton shape="sm" className="h-3 w-12" />
        </span>
        <Skeleton shape="sm" className="h-3 w-24" />
        <PageHeaderSep />
        <Skeleton shape="sm" className="h-3 w-32" />
        <PageHeaderSep />
        <Skeleton shape="sm" className="h-3 w-44" />
      </PageHeaderMeta>
    </PageHeader>
  );
}
