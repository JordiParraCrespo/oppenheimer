import type {
  CreateSessionCheckout,
  HostEntity,
  PullRequestAddress,
  PullRequestDetailEntity,
  ReviewSession,
} from '@oppenheimer/frontend-consumer';
import { reviews } from '@oppenheimer/frontend-consumer';

/**
 * Where a review session runs when the reader picks none: the online host the
 * reader's latest session ran on, else the first online host. `latestHostIds`
 * is newest first. Undefined when no host is online, since a session cut on
 * an offline host would only queue.
 */
export function reviewHost(
  hosts: readonly HostEntity[],
  latestHostIds: readonly string[],
): HostEntity | undefined {
  const online = hosts.filter((host) => host.online);
  const recent = latestHostIds.find((id) => online.some((host) => host.id === id));
  return online.find((host) => host.id === recent) ?? online[0];
}

/** What a host is asked to get ready before the press: the head branch of the pull request's repository. */
export function reviewCheckout(pull: PullRequestDetailEntity): CreateSessionCheckout {
  return {
    installationId: pull.installationId,
    githubRepoId: pull.githubRepoId,
    baseBranch: pull.headRef,
  };
}

/** The review session a pull request's Chat tab shows: its newest one not closed. */
export function latestReview(
  sessions: readonly ReviewSession[],
  address: PullRequestAddress,
): ReviewSession | null {
  return sessions.find((session) => reviews(session, address)) ?? null;
}

/** For review's groups: one per repository, in the order its newest session started. */
export function reviewGroups(
  sessions: readonly ReviewSession[],
  query: string,
): { repository: string; sessions: ReviewSession[] }[] {
  const term = query.trim().toLowerCase();
  const groups = new Map<string, ReviewSession[]>();
  for (const session of sessions) {
    const text = `#${session.number} ${session.title} ${session.repository}`.toLowerCase();
    if (term && !text.includes(term)) continue;
    groups.set(session.repository, [...(groups.get(session.repository) ?? []), session]);
  }
  return [...groups].map(([repository, rows]) => ({ repository, sessions: rows }));
}
