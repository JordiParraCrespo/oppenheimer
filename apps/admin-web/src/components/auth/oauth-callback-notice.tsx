import { Alert, AlertDescription } from '@oppenheimer/design-system-web';
import { Info } from '@oppenheimer/design-system-web/icons';
import { useTranslation } from 'react-i18next';

/**
 * The OAuth failures this deployment's auth config can actually produce, and
 * the sentence each one owes the reader.
 *
 * A social round-trip fails on a redirect the app never sees, so Better Auth
 * reports it the only way a redirect can: by sending the browser to the
 * caller's `errorCallbackURL` with `?error=<code>` appended. The codes below
 * are the two the API deliberately raises — anything else is a genuine
 * malfunction and falls through to the generic message, because "nothing
 * happened" is the one outcome a person cannot act on.
 */
const NOTICES = {
  /**
   * No account here for that provider identity. `disableImplicitSignUp` in the
   * API refuses to mint one from a sign-in. Administrators must be provisioned
   * through an existing control-plane account.
   */
  signup_disabled: { tone: 'guidance', key: 'control.auth.noAccount' },
  /**
   * The address belongs to an account that never verified its email, so the
   * API will not attach a provider to it (`requireLocalEmailVerified`). The
   * way in is the password that account was created with.
   */
  account_not_linked: { tone: 'failure', key: 'auth.oauth.accountNotLinked' },
} as const;

type OAuthErrorCode = keyof typeof NOTICES;

/**
 * Renders the `?error=` a social sign-in left behind, or nothing when the
 * screen was reached any other way.
 */
export function OAuthCallbackNotice({ code, className }: { code?: string; className?: string }) {
  const { t } = useTranslation();

  if (!code) return null;

  const notice = code in NOTICES ? NOTICES[code as OAuthErrorCode] : undefined;
  const guidance = notice?.tone === 'guidance';

  return (
    <Alert
      variant={guidance ? 'default' : 'destructive'}
      // The missing-account case is guidance, so it takes `Info` rather than
      // the alert disc.
      icon={guidance ? Info : undefined}
      className={className}
    >
      <AlertDescription>{notice ? t(notice.key) : t('auth.oauth.failed')}</AlertDescription>
    </Alert>
  );
}
