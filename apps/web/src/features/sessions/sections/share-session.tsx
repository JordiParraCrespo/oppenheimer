import { Button } from '@oppenheimer/design-system-web';
import { ErrorAlert, QueryState } from '@oppenheimer/frontend-web';
import type { ComponentType, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ShareSessionSkeleton } from '../components/share-session-skeleton';
import { ShareSessionPanel } from './share-session-panel';

/**
 * Share, wherever it is drawn (the session bar's popover, a row's dialog):
 * its placeholder while the session and its share are read, a first failure
 * with Try again, then the panel. `Title` is the surface's own title.
 */
export function ShareSession({
  sessionId,
  Title,
}: {
  sessionId: string;
  Title: ComponentType<{ className?: string; children: ReactNode }>;
}) {
  const { t } = useTranslation();
  return (
    <QueryState>
      <QueryState.Pending>
        <ShareSessionSkeleton Title={Title} />
      </QueryState.Pending>
      <QueryState.Error>
        {(error, retry) => (
          <div className="flex flex-col gap-3 p-4">
            <Title className="text-[14px] font-medium">{t('sessions.share.title')}</Title>
            <ErrorAlert
              error={error}
              fallback={t('sessions.share.loadFailed')}
              action={
                <Button variant="ghost" size="sm" onClick={retry}>
                  {t('common.retry')}
                </Button>
              }
            />
          </div>
        )}
      </QueryState.Error>
      <QueryState.Data>
        <ShareSessionPanel sessionId={sessionId} Title={Title} />
      </QueryState.Data>
    </QueryState>
  );
}
