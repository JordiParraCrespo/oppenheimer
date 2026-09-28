import { Alert, AlertAction, AlertDescription, IconButton } from '@oppenheimer/design-system-web';
import { XIcon } from '@oppenheimer/design-system-web/icons';
import { useErrorMessage } from '@oppenheimer/frontend-core/react';
import { useTranslation } from 'react-i18next';

/**
 * A failure, inline, where the reader still is: the destructive `Alert` with
 * the error resolved into the active locale.
 *
 * Twenty-eight screens wrote the same four lines — the alert, its description,
 * `useErrorMessage`, the fallback — and each could drift from the others; the
 * correlation id a bug report needs showed on none of them. Here it shows when
 * the server sent one, under the sentence, in mono.
 *
 * Renders nothing while `error` is `null`, so a caller writes
 * `<ErrorAlert error={mutation.error} … />` with no guard. `onDismiss` adds the
 * close button; wire it to `lastFailure(…).dismiss` or a mutation's `reset`.
 */
export function ErrorAlert({
  error,
  fallback,
  onDismiss,
  className,
}: {
  error: unknown;
  /** Already translated: the screen's own sentence for a failure with no known code. */
  fallback: string;
  onDismiss?: () => void;
  className?: string;
}) {
  const { t } = useTranslation();
  const resolveError = useErrorMessage();
  if (error === null || error === undefined) return null;
  const { message, correlationId } = resolveError(error, fallback);

  return (
    <Alert variant="destructive" className={className}>
      <AlertDescription>
        {message}
        {correlationId ? (
          <span className="block font-mono text-xs">
            {t('errors.correlationId', { id: correlationId })}
          </span>
        ) : null}
      </AlertDescription>
      {onDismiss ? (
        <AlertAction>
          <IconButton size="xs" aria-label={t('common.dismiss')} onClick={onDismiss}>
            <XIcon />
          </IconButton>
        </AlertAction>
      ) : null}
    </Alert>
  );
}
