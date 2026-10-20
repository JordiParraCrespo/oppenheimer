import { Field, FieldLabel, Skeleton } from '@oppenheimer/design-system-web';
import { useTranslation } from 'react-i18next';

/**
 * Start session's body before its reads answer, laid out as the form is: the
 * line naming the task, the Prompt field with its label written and the
 * textarea at its least height, the repository, host and agent pickers at
 * the chip-select's height, and the footer's two buttons.
 */
export function StartSessionSkeleton() {
  const { t } = useTranslation();
  return (
    <div aria-busy className="flex flex-col gap-4">
      <span role="status" className="sr-only">
        {t('common.loading')}
      </span>
      <span aria-hidden className="flex h-5 items-center">
        <Skeleton shape="sm" className="h-3 w-64" />
      </span>
      <div className="flex flex-col gap-4">
        <Field>
          <FieldLabel>{t('tasks.start.prompt')}</FieldLabel>
          <Skeleton shape="sm" className="h-22 w-full" />
        </Field>
        <div aria-hidden className="flex flex-wrap items-center gap-2">
          <Skeleton className="h-(--control-h-md) w-36" />
          <Skeleton className="h-(--control-h-md) w-32" />
          <Skeleton className="h-(--control-h-md) w-44" />
        </div>
        <div aria-hidden className="flex items-center justify-end gap-2">
          <Skeleton shape="pill" className="h-(--control-h-md) w-20" />
          <Skeleton shape="pill" className="h-(--control-h-md) w-30" />
        </div>
      </div>
    </div>
  );
}
