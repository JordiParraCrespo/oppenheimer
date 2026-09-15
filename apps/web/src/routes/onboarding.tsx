import { Alert, AlertDescription, Button, FieldGroup, Input } from '@oppenheimer/design-system-web';
import {
  useAcceptInvitation,
  useCreateOrganization,
  useLogout,
  useMyInvitations,
  useOrganizations,
} from '@oppenheimer/frontend/react';
import {
  type CreateOrganizationDto,
  createOrganizationSchema,
} from '@oppenheimer/shared/schemas/organization';
import { createFileRoute, Navigate, redirect, useNavigate } from '@tanstack/react-router';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import {
  AuthDivider,
  AuthEyebrow,
  AuthField,
  AuthSubtitle,
  AuthTitle,
  authControlClass,
  authInputClass,
} from '@/components/auth/auth-primitives';
import { BrandLogo } from '@/components/auth/brand-logo';
import { ThemeToggle } from '@/components/theme-toggle';
import { useErrorMessage } from '@/lib/use-error-message';
import { useZodResolver } from '@/lib/use-zod-resolver';

/**
 * Where a signed-in account with no workspace starts.
 *
 * Registering creates an account, not a tenancy. An account belongs nowhere
 * until it makes a workspace or an invitation puts it in one, so this screen
 * offers both: the invitations already addressed to this account, and a form
 * that creates a first organization and makes the caller its owner. The
 * product shell reads organization-scoped data on every screen, so sending a
 * new account there instead is how the first screen after signing up came to
 * be "You do not have permission to do that".
 */
export const Route = createFileRoute('/onboarding')({
  beforeLoad: ({ context, location }) => {
    if (!context.auth.isAuthenticated) {
      throw redirect({ to: '/login', search: { redirect: location.href } });
    }
  },
  component: OnboardingPage,
});

/**
 * The slug the API would derive anyway, shown so the reader is not surprised
 * by it. Kept in step with `createOrganizationSchema`'s pattern: lowercase,
 * digits and hyphens, at least two characters.
 */
function slugify(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

function OnboardingPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const resolveError = useErrorMessage();
  const organizations = useOrganizations();
  const invitations = useMyInvitations();
  const accept = useAcceptInvitation({ onSuccess: () => navigate({ to: '/dashboard' }) });
  const create = useCreateOrganization({ onSuccess: () => navigate({ to: '/dashboard' }) });
  const logout = useLogout({ onSuccess: () => navigate({ to: '/login' }) });

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateOrganizationDto>({
    resolver: useZodResolver(createOrganizationSchema),
    defaultValues: { name: '' },
  });

  // Somebody who already has a workspace has no business here — they arrive by
  // typing the URL, or by having accepted an invitation in another tab.
  if (organizations.data && organizations.data.length > 0) {
    return <Navigate to="/dashboard" replace />;
  }

  const pending = invitations.data ?? [];
  const busy = accept.isPending || create.isPending;
  const error = accept.error ?? create.error;

  const onSubmit = handleSubmit(({ name }) => {
    const slug = slugify(name);
    // A name with no slug-able characters ("日本") is the API's to name: sending
    // `slug: ''` would fail the schema's floor for no reason the reader can fix.
    create.mutate(slug.length >= 2 ? { name, slug } : { name });
  });

  return (
    <div className="flex min-h-svh flex-col bg-background px-6 py-10 min-[900px]:px-14">
      <ThemeToggle className="absolute top-8 right-6 z-10 min-[900px]:top-10 min-[900px]:right-14" />
      <BrandLogo />

      <div className="mx-auto flex w-full max-w-[400px] flex-1 flex-col justify-center py-6">
        <AuthEyebrow>{t('onboarding.eyebrow')}</AuthEyebrow>
        <AuthTitle>{t('onboarding.title')}</AuthTitle>
        <AuthSubtitle>{t('onboarding.description')}</AuthSubtitle>

        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{resolveError(error).message}</AlertDescription>
          </Alert>
        )}

        {pending.length > 0 && (
          <>
            <ul className="flex flex-col gap-3">
              {pending.map((invitation) => (
                <li
                  key={invitation.id}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-border-subtle p-3.5"
                >
                  <div className="min-w-0">
                    <div className="truncate text-base font-medium text-ink-900">
                      {t('onboarding.invitation.title')}
                    </div>
                    <div className="mt-px truncate text-xs text-ink-400">
                      {t('onboarding.invitation.role', { role: invitation.organizationRole })}
                    </div>
                  </div>
                  <Button size="sm" disabled={busy} onClick={() => accept.mutate(invitation.id)}>
                    {accept.isPending
                      ? t('onboarding.invitation.joining')
                      : t('onboarding.invitation.join')}
                  </Button>
                </li>
              ))}
            </ul>
            <AuthDivider label={t('common.or')} />
          </>
        )}

        <form onSubmit={onSubmit} noValidate>
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
                disabled={busy}
                className={authInputClass}
              />
            </AuthField>
            <p className="-mt-2 text-xs text-ink-400">{t('onboarding.create.hint')}</p>

            <Button type="submit" disabled={busy} className={authControlClass}>
              {create.isPending ? t('onboarding.create.submitting') : t('onboarding.create.submit')}
            </Button>
          </FieldGroup>
        </form>

        <Button
          variant="secondary"
          className="mt-7 w-fit self-start"
          disabled={logout.isPending}
          onClick={() => logout.mutate()}
        >
          {t('onboarding.signOut')}
        </Button>
      </div>
    </div>
  );
}
