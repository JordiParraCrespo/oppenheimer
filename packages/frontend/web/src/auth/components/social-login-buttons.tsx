import { BrandGlyph, Button, Callout } from '@oppenheimer/design-system-web';
import type { SocialAuthIntent } from '@oppenheimer/frontend-core';
import { useDeploymentCapabilities, useSocialLogin } from '@oppenheimer/frontend-core/react';
import { useTranslation } from 'react-i18next';
import { ErrorAlert } from '../../forms';

/**
 * The social sign-in row on the sign-in and create-account screens, showing
 * only providers the deployment configured (`GET /health/capabilities`).
 *
 * Until the capability read *succeeds*, every provider is assumed available:
 * an unreachable API is not a missing configuration. The "nothing configured"
 * hint, which names the env vars for the self-hoster, renders only from a
 * successful read reporting no providers.
 *
 * `intent` separates the two screens: the API refuses a provider identity it
 * has never seen unless the caller asks for a sign-up, so only the register
 * screen's buttons can create an account.
 */
export function SocialLoginButtons({
  disabled,
  intent = 'sign-in',
}: {
  disabled?: boolean;
  intent?: SocialAuthIntent;
}) {
  const { t } = useTranslation();
  const social = useSocialLogin();
  const { data, error } = useDeploymentCapabilities();

  // TanStack Query retains the last successful data after a failed refetch,
  // so `data` alone can be stale (e.g. read before an operator enabled OAuth
  // and restarted the API). Trust it only while the latest read succeeded;
  // any error means "unknown", which falls back to showing every provider.
  const capabilities = error == null ? data : undefined;

  const google = capabilities?.google_oauth ?? true;
  const github = capabilities?.github_oauth ?? true;

  if (!google && !github) {
    return <Callout>{t('auth.login.noSocialProviders')}</Callout>;
  }

  const busyWith = social.isPending ? social.variables?.provider : undefined;

  return (
    <div className="flex flex-col gap-2.5">
      {/* Starting the round-trip can fail before any redirect: the API unreachable, the provider rejected. */}
      <ErrorAlert error={social.error} fallback={t('auth.login.socialFailed')} />
      {/* The provider in flight is pending; the other is locked beside it,
          since one sign-in at a time is all a redirect can carry. */}
      {google && (
        <Button
          variant="social"
          size="lg"
          block
          type="button"
          pending={busyWith === 'google'}
          disabled={disabled || busyWith === 'github'}
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
          pending={busyWith === 'github'}
          disabled={disabled || busyWith === 'google'}
          onClick={() => social.mutate({ provider: 'github', intent })}
        >
          <BrandGlyph name="github" />
          {t('auth.login.continueWithGithub')}
        </Button>
      )}
    </div>
  );
}
