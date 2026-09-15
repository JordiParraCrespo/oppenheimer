import { AuthRequestError } from '@oppenheimer/auth/client';
import {
  Avatar,
  AvatarFallback,
  Button,
  cn,
  FieldGroup,
  Input,
} from '@oppenheimer/design-system-web';
import { useAuthState, useOppenheimerApp } from '@oppenheimer/frontend/react';
import { type AcceptInvitationDto, acceptInvitationSchema } from '@oppenheimer/shared/schemas/auth';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import {
  AuthEyebrow,
  AuthField,
  AuthFooterNote,
  AuthFormError,
  AuthSubtitle,
  AuthTitle,
  authControlClass,
  authInputClass,
} from '@/components/auth/auth-primitives';
import { PasswordInput } from '@/components/auth/password-input';
import {
  checkPassword,
  meetsRequirements,
  PasswordRequirements,
  type PasswordRule,
} from '@/components/auth/password-requirements';
import { useZodResolver } from '@/lib/use-zod-resolver';

const RULES: readonly PasswordRule[] = ['length', 'case', 'number'];

/** "Lucía Ferrer" → first "Lucía", last "Ferrer"; a single word becomes both. */
function splitName(fullName: string) {
  const parts = fullName.trim().split(/\s+/);
  const firstName = parts[0] ?? '';
  const lastName = parts.length > 1 ? parts.slice(1).join(' ') : firstName;

  return { firstName, lastName };
}

/** The initials shown on the inviter's avatar. */
function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export const Route = createFileRoute('/_auth/accept-invitation')({
  validateSearch: (
    search: Record<string, unknown>,
  ): {
    id?: string;
    email?: string;
    name?: string;
    role?: string;
    inviter?: string;
  } => ({
    id: (search.id as string) || undefined,
    email: (search.email as string) || undefined,
    name: (search.name as string) || undefined,
    role: (search.role as string) || undefined,
    inviter: (search.inviter as string) || undefined,
  }),
  component: AcceptInvitationPage,
});

function AcceptInvitationPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const app = useOppenheimerApp();
  const queryClient = useQueryClient();
  const { isAuthenticated } = useAuthState();
  const { id, email, name, role, inviter } = Route.useSearch();

  const invitationHref = `/accept-invitation?${new URLSearchParams(
    Object.entries({ id, email, name, role, inviter }).filter((entry): entry is [string, string] =>
      Boolean(entry[1]),
    ),
  ).toString()}`;

  const { mutate, isPending, error } = useMutation<void, Error, AcceptInvitationDto | undefined>({
    mutationFn: async (values) => {
      if (!id || !email) throw new Error(t('auth.acceptInvitation.invalidLink'));

      if (!isAuthenticated) {
        if (!values) throw new Error(t('auth.acceptInvitation.invalidLink'));
        try {
          await app.auth.register({
            email,
            password: values.password,
            ...splitName(values.fullName),
          });
        } catch (failure) {
          // The registration-shaped invitation page is also the entry point
          // for existing accounts. If Better Auth confirms the address already
          // exists, the password the person just supplied is their login
          // credential: authenticate and continue in the same submission.
          // A wrong password still fails normally and never accepts the invite.
          if (!isExistingAccountError(failure)) throw failure;
          await app.auth.login({ email, password: values.password });
        }
      }

      // Better Auth accepts the membership and selects its organization in one
      // transaction. Calling the separately policy-guarded set-active endpoint
      // here can turn a successful acceptance into a misleading 403.
      await app.organizations.acceptInvitation(id);
    },
    onSuccess: async () => {
      // Accepting is what puts this account in a workspace, and the app shell
      // decides where to send a signed-in reader by the workspaces it can see.
      // That list is cached for a minute and persisted across reloads, so
      // without dropping it here an invitee who passed through onboarding
      // first would be bounced straight back to it — asked to create a
      // workspace seconds after joining one.
      //
      // Awaited: the shell redirects on a settled empty list, and navigating
      // while the cached `[]` is still being refetched would race it.
      await queryClient.invalidateQueries();
      navigate({ to: '/sessions' });
    },
  });

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<AcceptInvitationDto>({
    resolver: useZodResolver(acceptInvitationSchema),
    defaultValues: { fullName: name ?? '', password: '' },
  });

  const password = useWatch({ control, name: 'password' });
  const results = checkPassword(password ?? '');
  const satisfied = meetsRequirements(results, RULES);

  const onSubmit = handleSubmit((values) => {
    mutate(values);
  });

  const linkIsValid = Boolean(id && email);

  return (
    <>
      <AuthEyebrow>{t('auth.acceptInvitation.eyebrow')}</AuthEyebrow>
      <AuthTitle>{t('auth.acceptInvitation.title')}</AuthTitle>
      <AuthSubtitle>{t('auth.acceptInvitation.description')}</AuthSubtitle>

      {inviter && (
        <div className="mb-7 flex items-center gap-3 rounded-2xl border border-border-subtle p-3.5">
          <Avatar size={38}>
            <AvatarFallback gradient="purple">{initials(inviter)}</AvatarFallback>
          </Avatar>
          <div>
            <div className="text-base font-medium text-ink-900">
              {t('auth.acceptInvitation.invitedYou', { inviter })}
            </div>
            <div className="mt-px text-xs text-ink-400">
              {[role && t('auth.acceptInvitation.joiningAs', { role }), email]
                .filter(Boolean)
                .join(' · ')}
            </div>
          </div>
        </div>
      )}

      {/*
        Every other auth screen puts its callout inside the form's `FieldGroup`,
        which supplies the 16px gap to the control below. Here it sits outside
        the form — the accepted-invitation branch has no form at all — so the
        block owns that spacing itself, instead of leaving the alert flush
        against the CTA.
      */}
      {(!linkIsValid || error) && (
        <div className="mb-4 flex flex-col gap-3">
          {!linkIsValid && <AuthFormError>{t('auth.acceptInvitation.invalidLink')}</AuthFormError>}
          {error && (
            <AuthFormError>
              {error instanceof Error ? error.message : t('auth.register.failed')}
            </AuthFormError>
          )}
        </div>
      )}

      {isAuthenticated ? (
        <Button
          type="button"
          disabled={isPending || !linkIsValid}
          className={authControlClass}
          onClick={() => mutate(undefined)}
        >
          {isPending
            ? t('auth.acceptInvitation.joining')
            : t('auth.acceptInvitation.acceptExisting')}
        </Button>
      ) : (
        <form onSubmit={onSubmit} noValidate>
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
      )}

      {!isAuthenticated && (
        <AuthFooterNote>
          {t('auth.register.hasAccount')}{' '}
          <Link
            to="/login"
            search={{ redirect: invitationHref, email }}
            className="text-accent-blue transition-opacity hover:opacity-80"
          >
            {t('auth.register.signIn')}
          </Link>
        </AuthFooterNote>
      )}
    </>
  );
}

function isExistingAccountError(error: unknown): boolean {
  if (!(error instanceof AuthRequestError)) return false;
  return (
    error.code === 'USER_ALREADY_EXISTS' || error.code === 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL'
  );
}
