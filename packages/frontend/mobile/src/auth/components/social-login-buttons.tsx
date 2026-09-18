import { Alert, AlertDescription } from '@oppenheimer/design-system-mobile/alert';
import { Button } from '@oppenheimer/design-system-mobile/button';
import { Info } from '@oppenheimer/design-system-mobile/icons';
import { Text } from '@oppenheimer/design-system-mobile/text';
import { cn } from '@oppenheimer/design-system-mobile/utils';
import type { SocialAuthIntent } from '@oppenheimer/frontend-core';
import {
  useDeploymentCapabilities,
  useErrorMessage,
  useSocialLogin,
} from '@oppenheimer/frontend-core/react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { AuthDivider, AuthFormError, authControlClass } from './auth-primitives';
import { GithubIcon, GoogleIcon } from './provider-icons';

/**
 * Social sign-in section of the login screen, driven by the deployment's
 * capability set (`GET /health/capabilities`) so only providers that are
 * actually configured render a button. The web kit's component of the same
 * name makes the same decisions from the same read.
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
  onSuccess,
}: {
  disabled?: boolean;
  intent?: SocialAuthIntent;
  /** Where the round-trip lands when it comes back signed in. */
  onSuccess?: () => void;
}) {
  const { t } = useTranslation();
  const resolveError = useErrorMessage();
  const social = useSocialLogin({ onSuccess });
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
    // the plain `Alert`, not the destructive one.
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
      {/* Starting the round-trip can fail before the browser ever opens — the
          API unreachable, the provider rejected server-side. It used to fail
          into a native alert the form knew nothing about. */}
      {social.error ? (
        <AuthFormError className="mb-2.5">
          {resolveError(social.error, t('auth.login.socialFailed')).message}
        </AuthFormError>
      ) : null}
      <View className="gap-2.5">
        {google ? (
          <Button
            variant="outline"
            disabled={disabled || social.isPending}
            onPress={() => social.mutate({ provider: 'google', intent })}
            className={providerButton}
          >
            <GoogleIcon />
            <Text>{t('auth.login.continueWithGoogle')}</Text>
          </Button>
        ) : null}
        {github ? (
          <Button
            variant="outline"
            disabled={disabled || social.isPending}
            onPress={() => social.mutate({ provider: 'github', intent })}
            className={providerButton}
          >
            <GithubIcon />
            <Text>{t('auth.login.continueWithGithub')}</Text>
          </Button>
        ) : null}
      </View>
    </>
  );
}
