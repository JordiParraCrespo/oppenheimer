import { Button, ChipSelect, EmptyState } from '@oppenheimer/design-system-web';
import { Cpu, SquareTerminal } from '@oppenheimer/design-system-web/icons';
import type { PullRequestDetailEntity } from '@oppenheimer/frontend-consumer';
import { useHosts, useSessions } from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert } from '@oppenheimer/frontend-web';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useReviewSession } from '../hooks/use-review-session';
import { reviewHost } from '../lib/review-session';

/**
 * The Chat tab before its review session: where it would run and the one
 * press that starts it. The chip says where it runs, on the host of the
 * reader's latest session while it is online, else the first online one;
 * picking another is the chip's. It reads the hosts and the sessions because
 * it draws the one and picks from the other. A fork's head is not on the
 * repository a host fetches, so its pull request says so instead.
 */
export function ReviewSessionStart({ pull }: { pull: PullRequestDetailEntity }) {
  const { t } = useTranslation();
  const [picked, setPicked] = useState<string | null>(null);
  const hosts = useHosts();
  const { data: latestHostIds = [] } = useSessions({
    select: (sessions) =>
      [...sessions]
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .flatMap((session) => (session.hostId ? [session.hostId] : [])),
  });
  const review = useReviewSession(pull);
  const list = hosts.data ?? [];
  const hostId =
    (picked && list.some((host) => host.id === picked) ? picked : null) ??
    reviewHost(list, latestHostIds)?.id ??
    null;
  const startable = Boolean(hostId) && !pull.fromFork;

  return (
    <EmptyState className="my-auto">
      <EmptyState.Header>
        <EmptyState.Media variant="icon">
          <SquareTerminal />
        </EmptyState.Media>
        <EmptyState.Title>{t('pullRequests.reviewSession.title')}</EmptyState.Title>
        <EmptyState.Description>
          {pull.fromFork
            ? t('pullRequests.reviewSession.fork')
            : hosts.data && !hostId
              ? t('pullRequests.reviewSession.noHost')
              : t('pullRequests.reviewSession.description', { branch: pull.headRef })}
        </EmptyState.Description>
      </EmptyState.Header>
      <ErrorAlert error={review.error} fallback={t('pullRequests.reviewSession.failed')} />
      {pull.fromFork ? null : (
        <EmptyState.Content className="flex-row justify-center">
          {list.length > 0 ? (
            <ChipSelect
              value={hostId}
              onValueChange={setPicked}
              options={list.map((host) => ({
                value: host.id,
                label: host.name,
                description: host.online
                  ? host.summary
                  : `${host.summary} · ${t('pullRequests.reviewSession.offline')}`,
                keywords: host.hostname ?? undefined,
                disabled: !host.online,
              }))}
              icon={<Cpu />}
              loading={hosts.isPending}
              aria-label={t('pullRequests.reviewSession.host')}
              placeholder={t('pullRequests.reviewSession.host')}
              searchPlaceholder={t('pullRequests.reviewSession.search')}
              emptyText={t('pullRequests.reviewSession.empty')}
            />
          ) : null}
          <Button
            disabled={!startable}
            pending={review.pending}
            pendingLabel={t('pullRequests.reviewSession.starting')}
            onPointerEnter={() => hostId && startable && review.warm(hostId)}
            onFocus={() => hostId && startable && review.warm(hostId)}
            onClick={() => hostId && review.start(hostId)}
          >
            {t('pullRequests.reviewSession.start')}
          </Button>
        </EmptyState.Content>
      )}
    </EmptyState>
  );
}
