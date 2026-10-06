import type { LineCommentInput, PullRequestAddress } from '@oppenheimer/frontend-consumer';
import { PageFrame } from '@oppenheimer/frontend-web';
import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import type { PullRequestView } from '../lib/pull-request-search';
import { PullRequestBriefing } from '../sections/pull-request-briefing';
import { PullRequestChanges } from '../sections/pull-request-changes';
import { PullRequestDescription } from '../sections/pull-request-description';
import { PullRequestToolbar } from '../sections/pull-request-toolbar';

/**
 * A pull request: the bar and one of its three views. The review's pending
 * line comments are the one thing two of them share — written on Changes,
 * posted from Submit review — so they live here.
 *
 * The route is `full` so the bar stays put. Changes is the diff, as wide as
 * the pane and scrolling under the bar; the briefing and the description are
 * pages, the shell's frame at the `briefing` and `narrow` measures (the
 * export's 980px brief and 760px article).
 */
export function PullRequestScreen({
  address,
  view,
}: {
  address: PullRequestAddress;
  view: PullRequestView;
}) {
  const navigate = useNavigate();
  const [pending, setPending] = useState<LineCommentInput[]>([]);
  const setView = (next: PullRequestView) =>
    navigate({ to: '.', search: { view: next === 'briefing' ? undefined : next } });

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PullRequestToolbar
        address={address}
        view={view}
        onViewChange={setView}
        pending={pending}
        onReviewSubmitted={() => setPending([])}
        onDiscardPending={() => setPending([])}
      />
      {view === 'description' ? (
        <PageFrame size="narrow">
          <PullRequestDescription address={address} />
        </PageFrame>
      ) : view === 'changes' ? (
        <div className="min-h-0 flex-1 overflow-y-auto px-6 pt-6 pb-12">
          <PullRequestChanges
            address={address}
            pending={pending}
            onAddPending={(comment) => setPending((current) => [...current, comment])}
            onDiscardPending={(index) =>
              setPending((current) => current.filter((_, i) => i !== index))
            }
          />
        </div>
      ) : (
        <PageFrame size="briefing">
          <PullRequestBriefing address={address} onReviewChanges={() => setView('changes')} />
        </PageFrame>
      )}
    </div>
  );
}
