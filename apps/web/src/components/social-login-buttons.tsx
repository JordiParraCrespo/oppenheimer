import { Alert, AlertDescription, Button, cn } from '@oppenheimer/design-system-web';
import { Info } from '@oppenheimer/design-system-web/icons';
import type { SocialAuthIntent } from '@oppenheimer/frontend';
import { useDeploymentCapabilities, useSocialLogin } from '@oppenheimer/frontend/react';
import { useTranslation } from 'react-i18next';
import { AuthDivider, authControlClass } from '@/components/auth/auth-primitives';
import { GithubIcon, GoogleIcon } from '@/components/auth/provider-icons';
import { useErrorMessage } from '@/lib/use-error-message';

/**
 * Social sign-in section of the login screen, driven by the deployment's
 * capability set (`GET /health/capabilities`) so only providers that are
 * actually configured render a button.
 *
 * Failure semantics matter here: until the capability read *succeeds* we
 * assume every provider is available, because an unreachable API is not a
 * missing configuration. The "nothing configured" hint — which names the env
 * vars to set, for the self-hoster who is the one person able to fix it —
 * only ever renders from a successful read reporting no providers.
 *
 * `intent` is what separates the two screens that render this. The API refuses
 * a provider identity it has never seen unless the caller asks for a sign-up,
 * so the login screen's buttons sign in only, and the register screen's are
 * the one place an account can be created from a provider.
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
  // so `data` alone can be stale (e.g. read before an operator enabled OAuth
  // and restarted the API). Trust it only while the latest read succeeded;
  // any error means "unknown", which falls back to showing every provider.
  const capabilities = error == null ? data : undefined;

  const google = capabilities?.google_oauth ?? true;
  const github = capabilities?.github_oauth ?? true;

  if (!google && !github) {
    // A notice, not a failure — nobody signing in did anything wrong — so it is
    // the plain `Alert`, not the destructive one. It was a centred grey
    // paragraph, which is the shape this screen is not allowed to invent.
    return (
      <Alert icon={Info} className="mt-4">
        <AlertDescription>{t('auth.login.noSocialProviders')}</AlertDescription>
      </Alert>
    );
  }

  const providerButton = cn(authControlClass, 'gap-2.5');

  return (
    <>
      <AuthDivider label={t('common.or')} />
      {/* Starting the round-trip can fail before the redirect ever happens —
          the API unreachable, the provider rejected server-side. It used to
          fail silently: the button simply stopped spinning. */}
      {social.error && (
        <Alert variant="destructive" className="mb-2.5">
          <AlertDescription>
            {resolveError(social.error, t('auth.login.socialFailed')).message}
          </AlertDescription>
        </Alert>
      )}
      <div className="flex flex-col gap-2.5">
        {google && (
          <Button
            variant="outline"
            type="button"
            disabled={disabled || social.isPending}
            onClick={() => social.mutate({ provider: 'google', intent })}
            className={providerButton}
          >
            <GoogleIcon />
            {t('auth.login.continueWithGoogle')}
          </Button>
        )}
        {github && (
          <Button
            variant="outline"
            type="button"
            disabled={disabled || social.isPending}
            onClick={() => social.mutate({ provider: 'github', intent })}
            className={providerButton}
          >
            <GithubIcon />
            {t('auth.login.continueWithGithub')}
          </Button>
        )}
      </div>
    </>
  );
}
