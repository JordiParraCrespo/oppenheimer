import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  IconButton,
  RoutineItem,
} from '@oppenheimer/design-system-web';
import { Ellipsis, GitPullRequest } from '@oppenheimer/design-system-web/icons';
import type { ReviewSession } from '@oppenheimer/frontend-consumer';
import { formatAge } from '@oppenheimer/frontend-web';
import { Link, useMatchRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { pullRequestLink } from '../lib/pull-request-search';

/**
 * One review session under For review: the pull request it reviews, opening
 * its Chat tab, and the ellipsis whose one item deletes it. A section because it reads
 * the route. The row owns its menu; the delete dialog is the list's, since the
 * row leaves on the click and the dialog must stay to show a failure. `now`
 * is the list's one minute clock.
 */
export function ReviewSessionRow({
  session,
  now,
  onDelete,
}: {
  session: ReviewSession;
  now: number;
  onDelete: (session: ReviewSession) => void;
}) {
  const { t } = useTranslation();
  const matchRoute = useMatchRoute();
  const [menuOpen, setMenuOpen] = useState(false);
  const link = pullRequestLink(session, 'chat');

  return (
    <RoutineItem
      name={`#${session.number} ${session.title}`}
      icon={<GitPullRequest />}
      meta={formatAge(session.createdAt, now, t)}
      active={Boolean(matchRoute({ to: link.to, params: link.params }))}
      render={<Link {...link} />}
      menuOpen={menuOpen}
      action={
        <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
          <DropdownMenuTrigger
            render={
              <IconButton aria-label={t('sessions.sidebar.actions')} size="xs" variant="quiet" />
            }
          >
            <Ellipsis />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-47.5">
            <DropdownMenuItem variant="destructive" onClick={() => onDelete(session)}>
              {t('sessions.sidebar.delete')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      }
    />
  );
}
