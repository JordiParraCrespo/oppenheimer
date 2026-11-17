import { Button } from '@oppenheimer/design-system-web';
import { type ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ErrorAlert } from '../../forms';
import { OfflineOnceContext, type OfflineRetry } from '../hooks/use-offline-once';

/**
 * Says "could not reach the server" once for the sections inside it. Offline,
 * every read fails the same way, and a sentence per section (the sidebar's
 * bots, then its sessions) says nothing the first did not. A section opts in
 * (`QueryState.Error offlineOnce`, or `useOfflineOnce` over a refetch's
 * error); its offline failure is drawn here, at the top of the scope, with
 * one Try again that retries every section that handed one over. A failure
 * the server answered stays in its section, and a section that did not opt in
 * (a dialog's, say) is never hidden.
 */
export function OfflineOnce({ children, className }: { children: ReactNode; className?: string }) {
  const { t } = useTranslation();
  const [failed, setFailed] = useState<ReadonlyMap<string, OfflineRetry>>(new Map());
  const handOver = (id: string, retry: OfflineRetry) => {
    setFailed((current) => new Map(current).set(id, retry));
    return () =>
      setFailed((current) => {
        const next = new Map(current);
        next.delete(id);
        return next;
      });
  };
  const retries = [...failed.values()];

  return (
    <OfflineOnceContext value={handOver}>
      <ErrorAlert
        message={failed.size > 0 ? t('errors.unreachable') : null}
        className={className}
        action={
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              for (const retry of retries) retry.current?.();
            }}
          >
            {t('common.retry')}
          </Button>
        }
      />
      {children}
    </OfflineOnceContext>
  );
}
