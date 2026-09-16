import { Alert, AlertDescription, BrandGlyph, Button } from '@oppenheimer/design-system-web';
import { Info } from '@oppenheimer/design-system-web/icons';
import type { SocialAuthIntent } from '@oppenheimer/frontend';
import { useDeploymentCapabilities, useSocialLogin } from '@oppenheimer/frontend/react';
import { useTranslation } from 'react-i18next';
import { useErrorMessage } from '@/lib/use-error-message';

/**
 * The social sign-in row at the top of the sign-in and create-account
 * screens, driven by the deployment's capability set
 * (`GET /health/capabilities`) so only providers that are configured render.
 *
 * Failure semantics: until the capability read *succeeds* every provider is
 * assumed available, because an unreachable API is not a missing
 * configuration. The "nothing configured" hint only renders from a
 * successful read reporting no providers.
 *
 * `intent` separates the two screens: the API refuses a provider identity it
 * has never seen unless the caller asks for a sign-up, so sign-in buttons sign
 * in only, and the create-account screen's are the one place an account can be
 * created from a provider.
 */
export function SocialLoginButtons({
  disabled,
  intent = 'sign-in',
}: {
  disabled?: boolean;
  intent?: SocialAuthIntent;
}) {
  const { t } = useTranslation();
  const resolveError = useErrorMessage();
  const social = useSocialLogin();
  const { data, error } = useDeploymentCapabilities();

  // TanStack Query retains the last successful data after a failed refetch,
  // so `data` alone can be stale. Trust it only while the latest read
  // succeeded; any error means "unknown", which shows every provider.
  const capabilities = error == null ? data : undefined;

  const google = capabilities?.google_oauth ?? true;
  const github = capabilities?.github_oauth ?? true;

  if (!google && !github) {
    return (
      <Alert icon={Info} className="mb-5">
        <AlertDescription>{t('auth.login.noSocialProviders')}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      {social.error && (
        <Alert variant="destructive">
          <AlertDescription>
            {resolveError(social.error, t('auth.login.socialFailed')).message}
          </AlertDescription>
        </Alert>
      )}
      {google && (
        <Button
          variant="social"
          size="lg"
          block
          type="button"
          disabled={disabled || social.isPending}
          onClick={() => social.mutate({ provider: 'google', intent })}
        >
          <BrandGlyph name="google" />
          {t('auth.login.continueWithGoogle')}
        </Button>
      )}
      {github && (
        <Button
          variant="social"
          size="lg"
          block
          type="button"
          disabled={disabled || social.isPending}
          onClick={() => social.mutate({ provider: 'github', intent })}
        >
          <BrandGlyph name="github" className="[filter:var(--brand-glyph-filter)]" />
          {t('auth.login.continueWithGithub')}
        </Button>
      )}
    </div>
  );
}
