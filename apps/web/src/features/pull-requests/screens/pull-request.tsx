import type { LineCommentInput, PullRequestAddress } from '@oppenheimer/frontend-consumer';
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
    <div className="flex min-h-0 flex-1 flex-col bg-canvas">
      <PullRequestToolbar
        address={address}
        view={view}
        onViewChange={setView}
        pending={pending}
        onReviewSubmitted={() => setPending([])}
        onDiscardPending={() => setPending([])}
      />
      <div className="min-h-0 flex-1 overflow-y-auto">
        {view === 'description' ? (
          <div className="px-8 pt-8 pb-12">
            <PullRequestDescription address={address} />
          </div>
        ) : view === 'changes' ? (
          <div className="px-6 pt-6 pb-12">
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
          <div className="mx-auto w-full max-w-245 px-8 pt-8 pb-12">
            <PullRequestBriefing address={address} onReviewChanges={() => setView('changes')} />
          </div>
        )}
      </div>
    </div>
  );
}
