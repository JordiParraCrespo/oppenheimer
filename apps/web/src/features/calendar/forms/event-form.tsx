import {
  Button,
  Checkbox,
  DatePicker,
  Field,
  FieldError,
  FieldLabel,
  Input,
  Textarea,
} from '@oppenheimer/design-system-web';
import {
  DictationField,
  dictateIntoField,
  ErrorAlert,
  type ResolvedErrorMessage,
  TimeField,
  useDatePickerCopy,
  useZodResolver,
  type VoiceInput,
} from '@oppenheimer/frontend-web';
import {
  type CreateCalendarEventDto,
  createCalendarEventSchema,
} from '@oppenheimer/shared/schemas/calendar';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import type { input } from 'zod';

export type EventFormValues = input<typeof createCalendarEventSchema>;

/**
 * A personal event (`20-plan-calendar.md` §2): a title, a day, all day or from
 * a start to an end on it, and notes, which can be dictated. An end that is
 * not after the start is refused on the end field.
 */
export function EventForm({
  values,
  today,
  voice,
  pending,
  error,
  submitLabel,
  onSubmit,
  onCancel,
  onDelete,
}: {
  values: EventFormValues;
  today: string;
  voice: VoiceInput;
  pending: boolean;
  error: ResolvedErrorMessage | null;
  submitLabel: string;
  onSubmit: (values: CreateCalendarEventDto) => void;
  onCancel: () => void;
  onDelete?: () => void;
}) {
  const { t } = useTranslation();
  const { register, control, handleSubmit, getValues, setValue, formState } = useForm<
    EventFormValues,
    unknown,
    CreateCalendarEventDto
  >({
    resolver: useZodResolver(createCalendarEventSchema),
    values,
  });
  const allDay = useWatch({ control, name: 'allDay' });
  const startTime = useWatch({ control, name: 'startTime' });
  const copy = useDatePickerCopy();

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)} noValidate>
      <Field data-invalid={Boolean(formState.errors.title)}>
        <FieldLabel htmlFor="event-title">{t('calendar.event.title')}</FieldLabel>
        <Input
          {...register('title')}
          id="event-title"
          aria-invalid={Boolean(formState.errors.title)}
          autoFocus
        />
        <FieldError errors={[formState.errors.title]} />
      </Field>
      <div className="flex flex-wrap items-center gap-3">
        <Controller
          control={control}
          name="date"
          render={({ field }) => (
            <DatePicker
              {...copy}
              value={field.value}
              onValueChange={(day) => day && field.onChange(day)}
              today={today}
            />
          )}
        />
        {/* biome-ignore lint/a11y/noLabelWithoutControl: the checkbox inside is the control. */}
        <label className="flex items-center gap-2 text-sm">
          <Controller
            control={control}
            name="allDay"
            render={({ field }) => (
              <Checkbox
                checked={field.value}
                onCheckedChange={(checked) => {
                  field.onChange(checked);
                  setValue('startTime', checked ? null : '09:00');
                  setValue('endTime', checked ? null : '10:00');
                }}
              />
            )}
          />
          {t('calendar.event.allDay')}
        </label>
      </div>
      {allDay ? null : (
        <Field data-invalid={Boolean(formState.errors.endTime)}>
          <div className="flex items-center gap-2">
            <Controller
              control={control}
              name="startTime"
              render={({ field }) => (
                <TimeField
                  value={field.value ?? null}
                  onChange={field.onChange}
                  clearable={false}
                />
              )}
            />
            <span className="text-fg-subtle">–</span>
            <Controller
              control={control}
              name="endTime"
              render={({ field }) => (
                <TimeField
                  value={field.value ?? null}
                  onChange={field.onChange}
                  after={startTime ?? undefined}
                  clearable={false}
                />
              )}
            />
          </div>
          <FieldError errors={[formState.errors.endTime]} />
        </Field>
      )}
      <Field>
        <FieldLabel htmlFor="event-notes">{t('calendar.event.notes')}</FieldLabel>
        <DictationField voice={voice} onText={dictateIntoField({ getValues, setValue }, 'notes')}>
          <Textarea {...register('notes')} id="event-notes" rows={3} />
        </DictationField>
      </Field>
      <ErrorAlert message={error?.message} correlationId={error?.correlationId} />
      <div className="flex items-center gap-2">
        {onDelete ? (
          <Button type="button" variant="destructive-ghost" onClick={onDelete}>
            {t('calendar.event.delete')}
          </Button>
        ) : null}
        <span className="flex-1" />
        <Button type="button" variant="ghost" onClick={onCancel}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" pending={pending}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
