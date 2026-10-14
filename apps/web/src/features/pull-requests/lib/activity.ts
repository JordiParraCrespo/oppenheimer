import type { PullRequestActivityItem } from '@oppenheimer/frontend-consumer';

/** Who commented on the conversation, first comment first, with how many each wrote. */
export function commenters(items: PullRequestActivityItem[]): { login: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    if (item.kind === 'comment') counts.set(item.author, (counts.get(item.author) ?? 0) + 1);
  }
  return [...counts].map(([login, count]) => ({ login, count }));
}
