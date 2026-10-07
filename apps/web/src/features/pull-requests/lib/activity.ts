import type { PullRequestActivityItem } from '@oppenheimer/frontend-consumer';

type Commit = Extract<PullRequestActivityItem, { kind: 'commit' }>;

/** What the Activity section draws: a run of pushed commits as one row, or one entry. */
export type ActivityEntry =
  | { kind: 'commits'; id: string; commits: Commit[]; at: Date }
  | Exclude<PullRequestActivityItem, { kind: 'commit' }>;

/** The conversation as the page reads it: commits pushed in a row fold into one entry. */
export function activityEntries(items: PullRequestActivityItem[]): ActivityEntry[] {
  const entries: ActivityEntry[] = [];
  for (const item of items) {
    if (item.kind !== 'commit') {
      entries.push(item);
      continue;
    }
    const last = entries.at(-1);
    if (last?.kind === 'commits') {
      last.commits.push(item);
      last.at = item.at;
    } else {
      entries.push({ kind: 'commits', id: item.id, commits: [item], at: item.at });
    }
  }
  return entries;
}

/** Who commented on the conversation, first comment first, with how many each wrote. */
export function commenters(items: PullRequestActivityItem[]): { login: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    if (item.kind === 'comment') counts.set(item.author, (counts.get(item.author) ?? 0) + 1);
  }
  return [...counts].map(([login, count]) => ({ login, count }));
}
