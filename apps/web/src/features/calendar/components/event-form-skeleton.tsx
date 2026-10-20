import { Field, FieldTitle, Skeleton } from '@oppenheimer/design-system-web';
import { useTranslation } from 'react-i18next';

/**
 * A saved event's form before the month answers, laid out as `EventForm` is:
 * the Title and Notes labels and All day written, a bar at each control's
 * height (the title field, the day, the two times, the notes box) and the
 * Delete, Cancel and Save buttons as pills, so the dialog does not grow when
 * the event lands.
 */
export function EventFormSkeleton() {
  const { t } = useTranslation();
  return (
    <div aria-busy className="flex flex-col gap-4">
      <span role="status" className="sr-only">
        {t('common.loading')}
      </span>
      <Field>
        <FieldTitle>{t('calendar.event.title')}</FieldTitle>
        <Skeleton shape="sm" className="h-(--control-h-md) w-full" />
      </Field>
      <div className="flex flex-wrap items-center gap-3">
        <Skeleton shape="sm" className="h-(--control-h-md) w-46" />
        <span className="flex items-center gap-2 text-sm">
          <Skeleton shape="sm" className="size-4.5 rounded-[5px]" />
          {t('calendar.event.allDay')}
        </span>
      </div>
      <div aria-hidden className="flex items-center gap-2">
        <Skeleton shape="pill" className="h-(--control-h-md) w-24" />
        <span className="text-fg-subtle">–</span>
        <Skeleton shape="pill" className="h-(--control-h-md) w-24" />
      </div>
      <Field>
        <FieldTitle>{t('calendar.event.notes')}</FieldTitle>
        <Skeleton shape="sm" className="h-[88px] w-full" />
      </Field>
      <div aria-hidden className="flex items-center gap-2">
        <Skeleton shape="pill" className="h-(--control-h-md) w-18" />
        <span className="flex-1" />
        <Skeleton shape="pill" className="h-(--control-h-md) w-20" />
        <Skeleton shape="pill" className="h-(--control-h-md) w-16" />
      </div>
    </div>
  );
}
