import {
  Button,
  DatePicker,
  Field,
  FieldError,
  FieldLabel,
  Input,
} from '@oppenheimer/design-system-web';
import {
  ErrorAlert,
  type ResolvedErrorMessage,
  useDatePickerCopy,
  useZodResolver,
} from '@oppenheimer/frontend-web';
import { type CreateMilestoneDto, createMilestoneSchema } from '@oppenheimer/shared/schemas/task';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import type { input } from 'zod';
import { ChoiceRow } from '../components/choice-row';
import { targetQuickDays } from '../lib/task-form';

export type MilestoneFormValues = input<typeof createMilestoneSchema>;

/**
 * New milestone and Edit milestone (`18-plan-product.md` §3): the name, the project (a
 * milestone always has one), and a target day with End of month and In 3 months.
 */
export function MilestoneForm({
  values,
  projects,
  today,
  pending,
  error,
  submitLabel,
  onSubmit,
  onCancel,
  onDelete,
}: {
  values: MilestoneFormValues;
  projects: readonly { id: string; name: string }[];
  today: string;
  pending: boolean;
  error: ResolvedErrorMessage | null;
  submitLabel: string;
  onSubmit: (values: CreateMilestoneDto) => void;
  onCancel: () => void;
  onDelete?: () => void;
}) {
  const { t } = useTranslation();
  const { register, control, handleSubmit, formState } = useForm<
    MilestoneFormValues,
    unknown,
    CreateMilestoneDto
  >({
    resolver: useZodResolver(createMilestoneSchema),
    values,
  });
  const quick = targetQuickDays(today);
  const copy = useDatePickerCopy();

  return (
    <form className="flex flex-col gap-5" onSubmit={handleSubmit(onSubmit)} noValidate>
      <Field data-invalid={Boolean(formState.errors.name)}>
        <FieldLabel htmlFor="milestone-name">{t('tasks.milestone.name')}</FieldLabel>
        <Input
          {...register('name')}
          id="milestone-name"
          placeholder={t('tasks.milestone.namePlaceholder')}
          aria-invalid={Boolean(formState.errors.name)}
          autoFocus
        />
        <FieldError errors={[formState.errors.name]} />
      </Field>
      <Controller
        control={control}
        name="projectId"
        render={({ field }) => (
          <ChoiceRow
            label={t('tasks.dialog.project')}
            choices={projects.map((project) => ({ value: project.id, label: project.name }))}
            value={field.value}
            onChange={(value) => value && field.onChange(value)}
          />
        )}
      />
      <div className="grid grid-cols-[96px_1fr] items-center gap-3">
        <span className="text-sm text-fg-muted">{t('tasks.milestone.target')}</span>
        <Controller
          control={control}
          name="targetDate"
          render={({ field }) => (
            <DatePicker
              {...copy}
              value={field.value ?? null}
              onValueChange={field.onChange}
              today={today}
              quick={[
                { label: t('tasks.dates.endOfMonth'), value: quick.endOfMonth },
                { label: t('tasks.dates.inThreeMonths'), value: quick.inThreeMonths },
              ]}
            />
          )}
        />
      </div>
      <ErrorAlert message={error?.message} correlationId={error?.correlationId} />
      <div className="flex items-center gap-2">
        {onDelete ? (
          <Button type="button" variant="destructive-ghost" onClick={onDelete}>
            {t('tasks.milestone.delete')}
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
