import { Button, cn, FieldGroup, Input } from '@oppenheimer/design-system-web';
import {
  AuthField,
  authControlClass,
  authInputClass,
  checkPassword,
  meetsRequirements,
  PasswordInput,
  PasswordRequirements,
  type PasswordRule,
  useZodResolver,
} from '@oppenheimer/frontend-web';
import { type AcceptInvitationDto, acceptInvitationSchema } from '@oppenheimer/shared/schemas/auth';
import { useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

const RULES: readonly PasswordRule[] = ['length', 'case', 'number'];

/** The account-creation half of the invitation page, for a reader with no account yet. */
export function AcceptInvitationForm({
  email,
  defaultName,
  isPending,
  linkIsValid,
  onSubmit,
}: {
  /** The invited address; fixed by the invitation, so shown read-only. */
  email?: string;
  defaultName?: string;
  isPending: boolean;
  linkIsValid: boolean;
  onSubmit: (values: AcceptInvitationDto) => void;
}) {
  const { t } = useTranslation();

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<AcceptInvitationDto>({
    resolver: useZodResolver(acceptInvitationSchema),
    defaultValues: { fullName: defaultName ?? '', password: '' },
  });

  // TODO(kit): the auth feature's `PasswordChecklist` subscribes at the leaf so
  // typing does not re-render the form; it cannot be imported across features,
  // so this form watches the field itself until the checklist moves to the kit.
  const password = useWatch({ control, name: 'password' });
  const results = checkPassword(password ?? '');
  const satisfied = meetsRequirements(results, RULES);

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <FieldGroup className="gap-4">
        <AuthField label={t('auth.email')} htmlFor="email">
          <Input
            id="email"
            type="email"
            value={email ?? ''}
            readOnly
            className={cn(authInputClass, 'cursor-not-allowed bg-surface-sunken text-ink-600')}
          />
        </AuthField>

        <AuthField
          label={t('auth.acceptInvitation.fullName')}
          htmlFor="fullName"
          error={errors.fullName}
        >
          <Input
            {...register('fullName')}
            id="fullName"
            autoComplete="name"
            placeholder={t('auth.acceptInvitation.fullNamePlaceholder')}
            aria-invalid={Boolean(errors.fullName)}
            disabled={isPending}
            className={authInputClass}
          />
        </AuthField>

        <AuthField
          label={t('auth.acceptInvitation.createPassword')}
          htmlFor="password"
          error={errors.password}
        >
          <PasswordInput
            {...register('password')}
            id="password"
            autoComplete="new-password"
            placeholder={t('auth.acceptInvitation.createPasswordPlaceholder')}
            aria-invalid={Boolean(errors.password)}
            disabled={isPending}
          />
        </AuthField>

        <PasswordRequirements results={results} rules={RULES} className="-mt-1.5 mb-1.5" />

        <Button
          type="submit"
          disabled={isPending || !satisfied || !linkIsValid}
          className={authControlClass}
        >
          {isPending ? t('auth.register.submitting') : t('auth.acceptInvitation.submit')}
        </Button>
      </FieldGroup>
    </form>
  );
}
