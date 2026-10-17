import {
  Button,
  Field,
  FieldError,
  FieldLabel,
  PasswordInput,
} from '@oppenheimer/design-system-web';
import { useZodResolver } from '@oppenheimer/frontend-web';
import {
  type PutModelProviderCredentialDto,
  putModelProviderCredentialSchema,
} from '@oppenheimer/shared/schemas/bot';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

/** One field: the provider's API key, hidden as it is typed, over the shared schema's bounds. */
export function ModelProviderKeyForm({
  isPending,
  onSubmit,
  onCancel,
}: {
  isPending: boolean;
  onSubmit: (values: PutModelProviderCredentialDto) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<PutModelProviderCredentialDto>({
    resolver: useZodResolver(putModelProviderCredentialSchema),
    defaultValues: { apiKey: '' },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
      <Field data-invalid={Boolean(errors.apiKey)}>
        <FieldLabel htmlFor="apiKey">{t('settings.modelProviders.dialog.label')}</FieldLabel>
        <PasswordInput
          {...register('apiKey')}
          id="apiKey"
          autoComplete="off"
          aria-invalid={Boolean(errors.apiKey)}
          disabled={isPending}
          showLabel={t('auth.showPassword')}
          hideLabel={t('auth.hidePassword')}
        />
        <FieldError errors={[errors.apiKey]} />
      </Field>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={isPending}>
          {t('common.cancel')}
        </Button>
        <Button
          type="submit"
          pending={isPending}
          pendingLabel={t('settings.modelProviders.dialog.saving')}
        >
          {t('settings.modelProviders.dialog.save')}
        </Button>
      </div>
    </form>
  );
}
