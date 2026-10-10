import {
  Button,
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  Input,
} from '@oppenheimer/design-system-web';
import { useZodResolver } from '@oppenheimer/frontend-web';
import {
  HOST_MAX_SESSIONS_CEILING,
  type SetHostSessionLimitDto,
  setHostSessionLimitSchema,
} from '@oppenheimer/shared/schemas/host';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

/**
 * One number, or nothing for the machine's default. The schema is the API's
 * own (`setHostSessionLimitSchema`), so an empty field is `null` and a limit
 * the route would refuse is refused here first.
 */
export function SessionLimitForm({
  maxSessions,
  sessionLimit,
  pending,
  onSubmit,
  onCancel,
}: {
  maxSessions: number | null;
  sessionLimit: number | null;
  pending: boolean;
  onSubmit: (maxSessions: number | null) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const { register, handleSubmit, formState } = useForm<SetHostSessionLimitDto>({
    resolver: useZodResolver(setHostSessionLimitSchema),
    defaultValues: { maxSessions },
  });
  const error = formState.errors.maxSessions;
  // What an empty field stands for: the limit the machine gets when nobody
  // set one, which is only known while no limit is set.
  const fallback = maxSessions === null ? sessionLimit : null;

  return (
    <form
      onSubmit={handleSubmit((values) => onSubmit(values.maxSessions))}
      noValidate
      className="flex flex-col gap-5"
    >
      <Field data-invalid={Boolean(error)}>
        <FieldLabel htmlFor="maxSessions">{t('hosts.settings.sessionLimit.label')}</FieldLabel>
        <Input
          {...register('maxSessions', {
            setValueAs: (value: unknown) =>
              value === '' || value === null || value === undefined ? null : Number(value),
          })}
          id="maxSessions"
          type="number"
          inputMode="numeric"
          min={1}
          max={HOST_MAX_SESSIONS_CEILING}
          placeholder={fallback !== null ? String(fallback) : undefined}
          aria-invalid={Boolean(error)}
          disabled={pending}
          className="w-28"
          autoFocus
        />
        <FieldDescription>
          {fallback !== null
            ? t('hosts.settings.sessionLimit.emptyDefault', { limit: fallback })
            : t('hosts.settings.sessionLimit.empty')}
        </FieldDescription>
        <FieldError errors={[error]} />
      </Field>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          {t('hosts.settings.cancel')}
        </Button>
        <Button type="submit" disabled={pending}>
          {t('hosts.settings.save')}
        </Button>
      </div>
    </form>
  );
}
