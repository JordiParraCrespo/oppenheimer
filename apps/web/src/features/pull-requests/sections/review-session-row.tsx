import { RoutineItem } from '@oppenheimer/design-system-web';
import { GitPullRequest } from '@oppenheimer/design-system-web/icons';
import type { ReviewSession } from '@oppenheimer/frontend-consumer';
import { formatAge } from '@oppenheimer/frontend-web';
import { Link, useMatchRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReviewSessionMenu } from '../components/review-session-menu';
import { pullRequestLink } from '../lib/pull-request-search';

/**
 * One review session under For review: the pull request it reviews, opening
 * its Chat tab, and the ellipsis that deletes it. A section because it reads
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
        <ReviewSessionMenu
          open={menuOpen}
          onOpenChange={setMenuOpen}
          onDelete={() => onDelete(session)}
        />
      }
    />
  );
}
