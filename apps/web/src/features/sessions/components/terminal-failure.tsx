import { Button } from '@oppenheimer/design-system-web';
import { ErrorAlert } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';

/**
 * A terminal's failure under its grid, with Try again: an attach refused or
 * ended, or a watcher's scrollback the host could not read. Said where the
 * reader is looking, never drawn as a quiet pane. `className` is the gutter
 * the terminal around it keeps.
 */
export function TerminalFailure({
  message,
  onRetry,
  onDismiss,
  className = 'px-5 pb-3',
}: {
  message: string;
  onRetry: () => void;
  onDismiss?: () => void;
  className?: string;
}) {
  const { t } = useTranslation();
  return (
    <div className={className}>
      <ErrorAlert
        message={message}
        onDismiss={onDismiss}
        action={
          <Button variant="ghost" size="sm" onClick={onRetry}>
            {t('sessions.session.retry')}
          </Button>
        }
      />
    </div>
  );
}
