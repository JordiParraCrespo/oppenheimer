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
   * API refuses to mint one from a sign-in, so this is guidance rather than a
   * failure — and it renders on `/register`, the screen that can act on it.
   */
  signup_disabled: { tone: 'guidance', key: null },
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
export function OAuthCallbackNotice({
  code,
  className,
  noAccountKey = 'auth.oauth.noAccount',
}: {
  code?: string;
  className?: string;
  /** The guidance for a provider identity with no account here; an app may word it its own way. */
  noAccountKey?: 'auth.oauth.noAccount' | 'control.auth.noAccount';
}) {
  const { t } = useTranslation();

  if (!code) return null;

  const notice = code in NOTICES ? NOTICES[code as OAuthErrorCode] : undefined;
  const guidance = notice?.tone === 'guidance';

  return (
    <Alert
      variant={guidance ? 'default' : 'destructive'}
      // Only the guidance case overrides the icon: nobody signing up did
      // anything wrong, so it takes `Info` rather than the alert disc.
      icon={guidance ? Info : undefined}
      className={className}
    >
      <AlertDescription>
        {notice ? t(notice.key ?? noAccountKey) : t('auth.oauth.failed')}
      </AlertDescription>
    </Alert>
  );
}
