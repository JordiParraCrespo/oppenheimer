import { Alert, AlertDescription, Button } from '@oppenheimer/design-system-web';
import { useCreateOrganization, useOrganizations } from '@oppenheimer/frontend-consumer/react';
import { useLogout } from '@oppenheimer/frontend-core/react';
import {
  AuthEyebrow,
  AuthSubtitle,
  AuthTitle,
  BrandLogo,
  ThemeToggle,
  useErrorMessage,
} from '@oppenheimer/frontend-web';
import { Navigate, useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { CreateOrganizationForm } from '@/features/organizations/forms/create-organization-form';
import { slugify } from '@/features/organizations/lib/slugify';

/**
 * The recovery path for a signed-in account with no workspace.
 *
 * Sign-up creates the personal workspace itself (`product/versions/mvp/08-auth.md`),
 * so an account normally never sees this screen. The sign-up hook is
 * best-effort, though, and the product shell reads workspace-scoped data on
 * every screen — for an account that ended up with none that is a refusal.
 * This screen creates the workspace and makes the caller its owner; there are
 * no invitations to accept, because workspaces are personal.
 */
export function OnboardingScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const resolveError = useErrorMessage();
  const organizations = useOrganizations();
  const create = useCreateOrganization({ onSuccess: () => navigate({ to: '/sessions' }) });
  const logout = useLogout({ onSuccess: () => navigate({ to: '/login' }) });

  // Somebody who already has a workspace has no business here — they arrive by
  // typing the URL.
  if (organizations.data && organizations.data.length > 0) {
    return <Navigate to="/sessions" replace />;
  }

  return (
    <div className="flex min-h-svh flex-col bg-background px-6 py-10 min-[900px]:px-14">
      <ThemeToggle className="absolute top-8 right-6 z-10 min-[900px]:top-10 min-[900px]:right-14" />
      <BrandLogo />

      <div className="mx-auto flex w-full max-w-[400px] flex-1 flex-col justify-center py-6">
        <AuthEyebrow>{t('onboarding.eyebrow')}</AuthEyebrow>
        <AuthTitle>{t('onboarding.title')}</AuthTitle>
        <AuthSubtitle>{t('onboarding.description')}</AuthSubtitle>

        {create.error && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{resolveError(create.error).message}</AlertDescription>
          </Alert>
        )}

        <CreateOrganizationForm
          disabled={create.isPending}
          isPending={create.isPending}
          onSubmit={({ name }) => {
            const slug = slugify(name);
            // A name with no slug-able characters ("日本") is the API's to name: sending
            // `slug: ''` would fail the schema's floor for no reason the reader can fix.
            create.mutate(slug.length >= 2 ? { name, slug } : { name });
          }}
        />

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
