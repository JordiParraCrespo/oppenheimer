import { Button } from '@oppenheimer/design-system-web';
import { ErrorAlert } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import type { CloudLaunchFailure, CloudLaunchFailureKind } from '../lib/cloud-launch-failure';

/** The one thing that fixes each failure: a key in settings, or the same send again. */
const ACTION: Record<CloudLaunchFailureKind, 'connect' | 'reconnect' | 'retry' | null> = {
  connect: 'connect',
  reconnect: 'reconnect',
  unavailable: 'retry',
  limited: 'retry',
  refused: null,
};

/**
 * A cloud launch that failed, in the vendor's name and with the one thing
 * that fixes it: connect or reconnect the key in settings, or send the same
 * launch again.
 */
export function CloudLaunchAlert({
  failure,
  vendor,
  onConnect,
  onRetry,
  onDismiss,
}: {
  failure: CloudLaunchFailure;
  /** The vendor's name, as its status labels it ("Cursor"). */
  vendor: string;
  onConnect: () => void;
  onRetry: () => void;
  onDismiss: () => void;
}) {
  const { t } = useTranslation();
  const message = failure.vendorSays
    ? t('sessions.new.cloudFailure.refusedSaying', { vendor, says: failure.vendorSays })
    : t(`sessions.new.cloudFailure.${failure.kind}`, { vendor });
  const action = ACTION[failure.kind];

  return (
    <ErrorAlert
      message={message}
      correlationId={failure.correlationId}
      action={
        <div className="flex items-center gap-1">
          {action ? (
            <Button variant="outline" size="sm" onClick={action === 'retry' ? onRetry : onConnect}>
              {action === 'retry'
                ? t('sessions.new.cloudFailure.retry')
                : t(`sessions.new.cloudFailure.${action}Action`, { vendor })}
            </Button>
          ) : null}
          <Button variant="ghost" size="sm" onClick={onDismiss}>
            {t('common.dismiss')}
          </Button>
        </div>
      }
    />
  );
}
