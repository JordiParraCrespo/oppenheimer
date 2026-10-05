import { Callout } from '@oppenheimer/design-system-web';
import { useTranslation } from 'react-i18next';
import { ErrorAlert } from '../../forms';

/*
 * The OAuth codes this deployment's auth config can produce, and the sentence
 * each one owes the reader. A failed social round-trip can only report through
 * the redirect: Better Auth sends the browser to the caller's `errorCallbackURL`
 * with `?error=<code>`. The two codes below are the ones the API raises on
 * purpose; anything else is a malfunction and gets the generic message.
 */

/** Codes that are guidance, not failure: nobody did anything wrong. */
const GUIDANCE = {
  /**
   * No account here for that provider identity. `disableImplicitSignUp` in the
   * API refuses to mint one from a sign-in, and this renders on `/register`,
   * the screen that can act on it.
   */
  signup_disabled: 'auth.oauth.noAccount',
} as const;

/** Codes that are failures, each with its own sentence. */
const FAILURES = {
  /**
   * The address belongs to an account that never verified its email, so the
   * API will not attach a provider to it (`requireLocalEmailVerified`). The
   * way in is the password that account was created with.
   */
  account_not_linked: 'auth.oauth.accountNotLinked',
} as const;

/**
 * Renders the `?error=` a social sign-in left behind, or nothing when the
 * screen was reached any other way.
 */
export function OAuthCallbackNotice({ code, className }: { code?: string; className?: string }) {
  const { t } = useTranslation();

  if (!code) return null;

  if (code in GUIDANCE) {
    return <Callout className={className}>{t(GUIDANCE[code as keyof typeof GUIDANCE])}</Callout>;
  }

  return (
    <ErrorAlert
      message={
        code in FAILURES ? t(FAILURES[code as keyof typeof FAILURES]) : t('auth.oauth.failed')
      }
      className={className}
    />
  );
}
