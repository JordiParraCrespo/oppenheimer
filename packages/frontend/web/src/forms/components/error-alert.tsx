import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
  Button,
} from '@oppenheimer/design-system-web';
import { useErrorMessage } from '@oppenheimer/frontend-core/react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useDismissible } from '../hooks/use-dismissible';
import { failureIdentity } from '../lib/failure-identity';
import { EMAIL_VERIFICATION_REQUIRED, EmailVerificationAlert } from './email-verification-alert';

/** Where the sentence comes from: a raw failure to resolve, or one already resolved. */
type ErrorAlertSource =
  | {
      error: unknown;
      /** Already translated: the screen's own sentence for a failure with no known code. */
      fallback: string;
      message?: never;
      correlationId?: never;
    }
  | {
      /**
       * A sentence already in the reader's language — a `ResolvedErrorMessage`'s,
       * once its field errors went onto the fields, or a state the screen words
       * itself. Nothing renders while it is empty.
       */
      message: string | null | undefined;
      correlationId?: string;
      error?: never;
      fallback?: never;
    };

/**
 * A failure, inline, where the reader still is: the destructive `Alert` with
 * the sentence in the active locale and, when the server sent one, the
 * correlation id a bug report needs, in mono under it.
 *
 * Hand it the raw `error` and a `fallback` and it resolves the sentence, or a
 * `message` a form already resolved. It renders nothing without one, so a
 * caller writes `<ErrorAlert error={mutation.error} … />` with no guard.
 *
 * `title` names what failed when one alert speaks for several rows. The one
 * action is Dismiss or the caller's own (`action`, a terminal's Retry).
 * Dismiss is always offered: with `onDismiss` (`lastFailure(…).dismiss` or a
 * mutation's `reset`) the caller clears the failure; without it the alert
 * hides itself until a different failure arrives.
 *
 * An unverified address (`TOKEN_010`) is drawn by `EmailVerificationAlert`,
 * whose action resends the verification link, unless the caller brings its
 * own action. Every screen that can be refused a credential shows it
 * through here, so each gets the way out without asking for it.
 */
export function ErrorAlert({
  title,
  onDismiss,
  action,
  className,
  ...source
}: ErrorAlertSource & {
  title?: ReactNode;
  onDismiss?: () => void;
  /** Takes the action slot instead of Dismiss. */
  action?: ReactNode;
  className?: string;
}) {
  const { t } = useTranslation();
  const resolveError = useErrorMessage();
  const resolved =
    source.message !== undefined
      ? source.message
        ? { message: source.message, correlationId: source.correlationId }
        : null
      : source.error === null || source.error === undefined
        ? null
        : resolveError(source.error, source.fallback);
  const { dismissed, dismiss } = useDismissible(failureIdentity(source));
  if (!resolved || dismissed) return null;
  const { message, correlationId } = resolved;
  if ('code' in resolved && resolved.code === EMAIL_VERIFICATION_REQUIRED && !action) {
    return (
      <EmailVerificationAlert
        message={message}
        correlationId={correlationId}
        title={title}
        className={className}
      />
    );
  }
  const trailing = action ?? (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => {
        dismiss();
        onDismiss?.();
      }}
    >
      {t('common.dismiss')}
    </Button>
  );

  return (
    <Alert tone="danger" className={className}>
      {title ? <AlertTitle>{title}</AlertTitle> : null}
      <AlertDescription>
        {message}
        {correlationId ? (
          <span className="block font-mono text-xs">
            {t('errors.correlationId', { id: correlationId })}
          </span>
        ) : null}
      </AlertDescription>
      <AlertAction>{trailing}</AlertAction>
    </Alert>
  );
}
