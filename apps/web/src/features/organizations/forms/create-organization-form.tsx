import { Button, FieldGroup, Input } from '@oppenheimer/design-system-web';
import {
  AuthField,
  authControlClass,
  authInputClass,
  useZodResolver,
} from '@oppenheimer/frontend-web';
import {
  type CreateOrganizationDto,
  createOrganizationSchema,
} from '@oppenheimer/shared/schemas/organization';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

export function CreateOrganizationForm({
  disabled,
  isPending,
  onSubmit,
}: {
  /** Disabled while any sibling action (accepting an invitation) is in flight. */
  disabled: boolean;
  isPending: boolean;
  onSubmit: (values: CreateOrganizationDto) => void;
}) {
  const { t } = useTranslation();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateOrganizationDto>({
    resolver: useZodResolver(createOrganizationSchema),
    defaultValues: { name: '' },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <FieldGroup className="gap-4">
        <AuthField
          label={t('onboarding.create.name')}
          htmlFor="organization-name"
          error={errors.name}
        >
          <Input
            {...register('name')}
            id="organization-name"
            autoComplete="organization"
            placeholder={t('onboarding.create.namePlaceholder')}
            aria-invalid={Boolean(errors.name)}
            disabled={disabled}
            className={authInputClass}
          />
        </AuthField>
        <p className="-mt-2 text-xs text-ink-400">{t('onboarding.create.hint')}</p>

        <Button type="submit" disabled={disabled} className={authControlClass}>
          {isPending ? t('onboarding.create.submitting') : t('onboarding.create.submit')}
        </Button>
      </FieldGroup>
    </form>
  );
}
