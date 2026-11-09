import { Button, Field, FieldTitle, Skeleton } from '@oppenheimer/design-system-web';
import { LoadingStatus } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';

/**
 * A saved event's form before the month answers, laid out as `EventForm` is:
 * the Title and Notes labels and All day written, a bar at each control's
 * height (the title field, the day, the two times, the notes box) and the
 * Delete, Cancel and Save buttons written and disabled, so the dialog does
 * not grow when the event lands.
 */
export function EventFormSkeleton() {
  const { t } = useTranslation();
  return (
    <div aria-busy className="flex flex-col gap-4">
      <LoadingStatus />
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
        {/* A block stands in here: the notes textarea, three rows at its own height. */}
        <Skeleton shape="sm" className="h-22 w-full" />
      </Field>
      <div className="flex items-center gap-2">
        <Button type="button" variant="destructive-ghost" disabled>
          {t('calendar.event.delete')}
        </Button>
        <span className="flex-1" />
        <Button type="button" variant="ghost" disabled>
          {t('common.cancel')}
        </Button>
        <Button type="button" disabled>
          {t('calendar.event.save')}
        </Button>
      </div>
    </div>
  );
}
