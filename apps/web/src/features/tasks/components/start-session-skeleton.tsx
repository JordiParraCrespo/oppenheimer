import { Button, Field, FieldLabel, Skeleton } from '@oppenheimer/design-system-web';
import { LoadingStatus } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';

/**
 * Start session's body before its reads answer, laid out as the form is: the
 * line naming the task, the Prompt field with its label written and the
 * textarea at its least height, the repository, place, host and agent
 * pickers at the chip-select's height (the default place, a host, draws all
 * four), and the footer's Cancel and Start, disabled.
 */
export function StartSessionSkeleton() {
  const { t } = useTranslation();
  return (
    <div aria-busy className="flex flex-col gap-4">
      <LoadingStatus />
      <span aria-hidden className="flex h-5 items-center">
        <Skeleton shape="sm" className="h-3 w-64" />
      </span>
      <div className="flex flex-col gap-4">
        <Field>
          <FieldLabel>{t('tasks.start.prompt')}</FieldLabel>
          {/* A block stands in here: the prompt's textarea, at its least height. */}
          <Skeleton shape="sm" className="h-22 w-full" />
        </Field>
        <div aria-hidden className="flex flex-wrap items-center gap-2">
          <Skeleton className="h-(--control-h-md) w-36" />
          <Skeleton className="h-(--control-h-md) w-32" />
          <Skeleton className="h-(--control-h-md) w-28" />
          <Skeleton className="h-(--control-h-md) w-44" />
        </div>
        <div className="flex items-center justify-end gap-2">
          <Button type="button" variant="ghost" disabled>
            {t('common.cancel')}
          </Button>
          <Button type="button" disabled>
            {t('tasks.start.start')}
          </Button>
        </div>
      </div>
    </div>
  );
}
