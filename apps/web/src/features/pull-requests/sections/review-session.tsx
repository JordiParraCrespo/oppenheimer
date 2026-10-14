import { Button, ChipSelect } from '@oppenheimer/design-system-web';
import { Cpu, SquareTerminal } from '@oppenheimer/design-system-web/icons';
import type { PullRequestDetailEntity } from '@oppenheimer/frontend-consumer';
import { useHosts, useSessions } from '@oppenheimer/frontend-consumer/react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useReviewSession } from '../hooks/use-review-session';
import { reviewHost } from '../lib/review-session';

/**
 * Review in a session: a worktree of the pull request's head branch on one of
 * the reader's hosts, with Claude Code started on a review prompt. The chip
 * says where it runs, on the host of the reader's latest session while it is
 * online, else the first online one; picking another is the chip's. It reads
 * the hosts and the sessions because it draws the one and picks from the
 * other. A fork's head is not on the repository a host fetches, so its pull
 * requests say so instead.
 */
export function ReviewSession({ pull }: { pull: PullRequestDetailEntity }) {
  const { t } = useTranslation();
  const [picked, setPicked] = useState<string | null>(null);
  const hosts = useHosts();
  const { data: latestHostIds = [] } = useSessions({
    select: (sessions) =>
      [...sessions]
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .map((session) => session.hostId),
  });
  const review = useReviewSession(pull);
  const list = hosts.data ?? [];
  const hostId =
    (picked && list.some((host) => host.id === picked) ? picked : null) ??
    reviewHost(list, latestHostIds)?.id ??
    null;
  const blocked = pull.fromFork
    ? t('pullRequests.reviewSession.fork')
    : hosts.data && !hostId
      ? t('pullRequests.reviewSession.noHost')
      : null;

  return (
    <div className="flex items-center gap-1.5">
      {pull.fromFork || list.length === 0 ? null : (
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
      )}
      <Button
        variant="secondary"
        size="sm"
        disabled={!hostId || pull.fromFork}
        title={blocked ?? undefined}
        pending={review.pending}
        pendingLabel={t('pullRequests.reviewSession.starting')}
        onPointerEnter={() => hostId && !pull.fromFork && review.warm(hostId)}
        onFocus={() => hostId && !pull.fromFork && review.warm(hostId)}
        onClick={() => hostId && review.start(hostId)}
      >
        <SquareTerminal />
        {t('pullRequests.reviewSession.start')}
      </Button>
    </div>
  );
}
