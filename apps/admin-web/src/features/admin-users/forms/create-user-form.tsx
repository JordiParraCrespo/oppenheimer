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
import { type AdminCreateUserDto, adminCreateUserSchema } from '@oppenheimer/shared/schemas/admin';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

export function CreateUserForm({
  isPending,
  error,
  onSubmit,
  onCancel,
}: {
  isPending: boolean;
  error: Error | null;
  onSubmit: (values: AdminCreateUserDto) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const resolveError = useErrorMessage();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<AdminCreateUserDto>({
    resolver: useZodResolver(adminCreateUserSchema),
    defaultValues: { email: '', name: '', password: '', role: 'user' },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <FieldGroup>
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{resolveError(error, t('common.error')).message}</AlertDescription>
          </Alert>
        )}
        <Field data-invalid={Boolean(errors.name)}>
          <FieldLabel htmlFor="admin-user-name">{t('control.users.columns.name')}</FieldLabel>
          <Input id="admin-user-name" {...register('name')} disabled={isPending} />
          <FieldError errors={[errors.name]} />
        </Field>
        <Field data-invalid={Boolean(errors.email)}>
          <FieldLabel htmlFor="admin-user-email">{t('control.users.columns.email')}</FieldLabel>
          <Input id="admin-user-email" type="email" {...register('email')} disabled={isPending} />
          <FieldError errors={[errors.email]} />
        </Field>
        <Field data-invalid={Boolean(errors.password)}>
          <FieldLabel htmlFor="admin-user-password">
            {t('control.users.create.password')}
          </FieldLabel>
          <Input
            id="admin-user-password"
            type="password"
            {...register('password')}
            disabled={isPending}
          />
          <FieldError errors={[errors.password]} />
        </Field>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" disabled={isPending}>
            {t('control.users.create.submit')}
          </Button>
        </DialogFooter>
      </FieldGroup>
    </form>
  );
}
