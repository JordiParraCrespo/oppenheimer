import {
  Button,
  Field,
  FieldError,
  FieldLabel,
  PasswordInput,
} from '@oppenheimer/design-system-web';
import { useZodResolver } from '@oppenheimer/frontend-web';
import {
  type PutCloudAgentCredentialDto,
  putCloudAgentCredentialSchema,
} from '@oppenheimer/shared/schemas/cloud-agent';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

/** One field: the vendor's API key, hidden as it is typed, over the shared schema's bounds. */
export function CloudAgentKeyForm({
  isPending,
  onSubmit,
  onCancel,
}: {
  isPending: boolean;
  onSubmit: (values: PutCloudAgentCredentialDto) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<PutCloudAgentCredentialDto>({
    resolver: useZodResolver(putCloudAgentCredentialSchema),
    defaultValues: { apiKey: '' },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
      <Field data-invalid={Boolean(errors.apiKey)}>
        <FieldLabel htmlFor="cloudAgentKey">{t('settings.cloudAgents.dialog.label')}</FieldLabel>
        <PasswordInput
          {...register('apiKey')}
          id="cloudAgentKey"
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
          pendingLabel={t('settings.cloudAgents.dialog.saving')}
        >
          {t('settings.cloudAgents.dialog.save')}
        </Button>
      </div>
    </form>
  );
}
