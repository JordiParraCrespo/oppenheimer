import {
  SidebarListHead,
  SidebarProjectGroup,
  SidebarProjectHeader,
  useNow,
} from '@oppenheimer/design-system-web';
import type { ReviewSession } from '@oppenheimer/frontend-consumer';
import { useReviewSessions } from '@oppenheimer/frontend-consumer/react';
import { CORE_CONFIG } from '@oppenheimer/frontend-core/config';
import { ErrorAlert, SidebarSearchField } from '@oppenheimer/frontend-web';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DeleteReviewSessionDialog } from '../dialogs/delete-review-session';
import { reviewGroups } from '../lib/review-session';
import { ReviewSessionRow } from './review-session-row';

/**
 * For review: the reader's review sessions not closed, grouped by repository,
 * each row the pull request it reviews and opening its Chat tab. They are
 * listed here and never under Sessions. The search filters in the browser:
 * the list arrives whole, and the field hands it the settled word. One clock for every row's age. Nothing is drawn
 * until there is a review session, unless the list could not be read.
 *
 * The delete dialog is held here, not by the row, and always in the same
 * place: the row leaves the list on the click, and the dialog stays to show
 * a failure, even when its row was the last.
 */
export function ReviewSessionsList() {
  const { t } = useTranslation();
  const now = useNow(CORE_CONFIG.clock.everyMinuteMs);
  const [query, setQuery] = useState('');
  const [closed, setClosed] = useState<ReadonlySet<string>>(new Set());
  const [deleting, setDeleting] = useState<ReviewSession | null>(null);
  const { data: sessions = [], error } = useReviewSessions();
  const groups = reviewGroups(sessions, query);

  return (
    <>
      {sessions.length === 0 ? (
        // A list that could not be read says so; one with nothing in it draws nothing.
        error ? (
          <div className="px-3 pt-2">
            <ErrorAlert error={error} fallback={t('pullRequests.reviewSession.listFailed')} />
          </div>
        ) : null
      ) : (
        <div className="flex flex-col pt-2">
          <SidebarListHead label={t('pullRequests.sidebar.forReview')} count={sessions.length} />
          <SidebarSearchField
            onChange={setQuery}
            label={t('pullRequests.sidebar.searchReviews')}
            clearLabel={t('pullRequests.sidebar.clearSearch')}
          />
          {groups.map((group) => {
            const open = !closed.has(group.repository);
            return (
              <SidebarProjectGroup key={group.repository}>
                <SidebarProjectHeader
                  name={group.repository.split('/').pop()}
                  count={group.sessions.length}
                  open={open}
                  onOpenChange={(next) =>
                    setClosed((current) => {
                      const updated = new Set(current);
                      if (next) updated.delete(group.repository);
                      else updated.add(group.repository);
                      return updated;
                    })
                  }
                />
                {open ? (
                  <div className="flex flex-col gap-0.5 pb-1">
                    {group.sessions.map((session) => (
                      <ReviewSessionRow
                        key={session.sessionId}
                        session={session}
                        now={now}
                        onDelete={setDeleting}
                      />
                    ))}
                  </div>
                ) : null}
              </SidebarProjectGroup>
            );
          })}
        </div>
      )}
      {deleting ? (
        <DeleteReviewSessionDialog session={deleting} onClose={() => setDeleting(null)} />
      ) : null}
    </>
  );
}
