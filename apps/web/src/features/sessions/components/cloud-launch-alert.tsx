import { Button } from '@oppenheimer/design-system-web';
import { ErrorAlert } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import type { CloudLaunchFailure } from '../lib/cloud-launch-failure';

/**
 * A cloud launch that failed, in the vendor's name and with the one thing
 * that fixes it: connect or reconnect the key in settings, or send the same
 * draft again. A failure the reader fixes themselves carries no reference;
 * one only a bug report can explain keeps it.
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
  const copy = {
    connect: {
      message: t('sessions.new.cloudFailure.connect', { vendor }),
      action: t('sessions.new.cloudFailure.connectAction', { vendor }),
      onAction: onConnect,
    },
    reconnect: {
      message: t('sessions.new.cloudFailure.reconnect', { vendor }),
      action: t('sessions.new.cloudFailure.reconnectAction', { vendor }),
      onAction: onConnect,
    },
    unavailable: {
      message: t('sessions.new.cloudFailure.unavailable', { vendor }),
      action: t('sessions.new.cloudFailure.retry'),
      onAction: onRetry,
    },
    limited: {
      message: t('sessions.new.cloudFailure.limited', { vendor }),
      action: t('sessions.new.cloudFailure.retry'),
      onAction: onRetry,
    },
    refused: {
      message:
        failure.kind === 'refused' && failure.vendorSays
          ? t('sessions.new.cloudFailure.refusedSaying', { vendor, says: failure.vendorSays })
          : t('sessions.new.cloudFailure.refused', { vendor }),
      action: null,
      onAction: onDismiss,
    },
  }[failure.kind];

  return (
    <ErrorAlert
      message={copy.message}
      correlationId={'correlationId' in failure ? failure.correlationId : undefined}
      action={
        <div className="flex items-center gap-1">
          {copy.action ? (
            <Button variant="outline" size="sm" onClick={copy.onAction}>
              {copy.action}
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
