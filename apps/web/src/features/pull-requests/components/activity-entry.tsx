import { Avatar, AvatarFallback } from '@oppenheimer/design-system-web';
import {
  CircleAlert,
  CircleCheck,
  CircleDot,
  GitCommitHorizontal,
  GitMerge,
  MessageSquare,
} from '@oppenheimer/design-system-web/icons';
import { RelativeTime } from '@oppenheimer/frontend-web';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { ActivityEntry as Entry } from '../lib/activity';
import { MarkdownBody } from './markdown-body';

function row(icon: ReactNode, text: ReactNode, at: Date, children?: ReactNode) {
  return (
    <li className="flex flex-col gap-3 rounded-sm border border-border-subtle bg-card px-4 py-3">
      <div className="flex items-center gap-3 text-operate text-fg">
        <span className="flex size-4 shrink-0 items-center justify-center text-fg-muted">
          {icon}
        </span>
        <span className="min-w-0 flex-1">{text}</span>
        <span className="shrink-0 text-sm text-fg-muted">
          <RelativeTime date={at} />
        </span>
      </div>
      {children}
    </li>
  );
}

/**
 * One entry of a pull request's conversation, the way the Codex app lists
 * them: a run of commits as one row that opens to the list, a comment as a
 * card with its Markdown, a review or an event as a line naming who did it.
 */
export function ActivityEntry({ entry, base }: { entry: Entry; base: string }) {
  const { t } = useTranslation();
  const icon = { className: 'size-4', 'aria-hidden': true } as const;
  switch (entry.kind) {
    case 'commits':
      return row(
        <GitCommitHorizontal {...icon} />,
        <details>
          <summary className="cursor-pointer">
            {t('pullRequests.detail.activity.commits', { count: entry.commits.length })}
          </summary>
          <ul className="mt-2 flex flex-col gap-1.5">
            {entry.commits.map((commit) => (
              <li key={commit.id} className="flex items-baseline gap-3 text-sm">
                <span className="figures shrink-0 text-xs text-fg-muted">
                  {commit.sha.slice(0, 7)}
                </span>
                <span className="min-w-0 truncate">{commit.message.split('\n')[0]}</span>
              </li>
            ))}
          </ul>
        </details>,
        entry.at,
      );
    case 'comment':
      return (
        <li className="flex flex-col gap-3 rounded-sm border border-border-subtle bg-card px-4 py-3">
          <div className="flex items-center gap-2.5 text-operate">
            <Avatar size="sm">
              <AvatarFallback>{entry.author.slice(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <span className="font-medium text-fg">{entry.author}</span>
            <span className="text-sm text-fg-muted">
              <RelativeTime date={entry.at} />
            </span>
          </div>
          <MarkdownBody source={entry.body} base={base} />
        </li>
      );
    case 'review':
      return row(
        entry.state === 'approved' ? (
          <CircleCheck {...icon} className="size-4 text-success" />
        ) : entry.state === 'changes_requested' ? (
          <CircleAlert {...icon} className="size-4 text-danger" />
        ) : (
          <MessageSquare {...icon} />
        ),
        t(`pullRequests.detail.activity.review.${entry.state}`, { author: entry.author }),
        entry.at,
        entry.body.trim() ? <MarkdownBody source={entry.body} base={base} /> : null,
      );
    case 'event':
      return row(
        entry.event === 'merged' ? <GitMerge {...icon} /> : <CircleDot {...icon} />,
        t(`pullRequests.detail.activity.event.${entry.event}`, {
          author: entry.author,
          subject: entry.subject ?? '',
        }),
        entry.at,
      );
  }
}
