import {
  Alert,
  AlertDescription,
  Button,
  DialogFooter,
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  Input,
} from '@oppenheimer/design-system-web';
import { useErrorMessage, useZodResolver } from '@oppenheimer/frontend-web';
import { type SetUserPasswordDto, setUserPasswordSchema } from '@oppenheimer/shared/schemas/admin';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

export function SetPasswordForm({
  isPending,
  error,
  onSubmit,
  onCancel,
}: {
  isPending: boolean;
  error: Error | null;
  onSubmit: (values: SetUserPasswordDto) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const resolveError = useErrorMessage();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SetUserPasswordDto>({
    resolver: useZodResolver(setUserPasswordSchema),
    defaultValues: { newPassword: '' },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <FieldGroup>
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{resolveError(error, t('common.error')).message}</AlertDescription>
          </Alert>
        )}
        <Field data-invalid={Boolean(errors.newPassword)}>
          <FieldLabel htmlFor="new-user-password">{t('control.users.password.label')}</FieldLabel>
          <Input
            id="new-user-password"
            type="password"
            {...register('newPassword')}
            disabled={isPending}
          />
          <FieldError errors={[errors.newPassword]} />
        </Field>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" disabled={isPending}>
            {t('control.users.password.submit')}
          </Button>
        </DialogFooter>
      </FieldGroup>
    </form>
  );
}
