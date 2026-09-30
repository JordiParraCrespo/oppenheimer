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
 * Twenty-eight screens wrote the same four lines — the alert, its description,
 * `useErrorMessage`, the fallback — and each could drift from the others. Hand
 * it the raw `error` and a `fallback`, and it resolves the sentence; hand it a
 * `message` a form already resolved (its field errors marked on the fields) and
 * it draws that. Either way it renders nothing without one, so a caller writes
 * `<ErrorAlert error={mutation.error} … />` with no guard.
 *
 * `title` names what failed when one alert speaks for several rows. The one
 * action is either Dismiss (`onDismiss`: wire it to `lastFailure(…).dismiss` or
 * a mutation's `reset`) or the caller's own (`action`, a terminal's Retry).
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
  if (!resolved) return null;
  const { message, correlationId } = resolved;
  const trailing =
    action ??
    (onDismiss ? (
      <Button variant="ghost" size="sm" onClick={onDismiss}>
        {t('common.dismiss')}
      </Button>
    ) : null);

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
      {trailing ? <AlertAction>{trailing}</AlertAction> : null}
    </Alert>
  );
}
