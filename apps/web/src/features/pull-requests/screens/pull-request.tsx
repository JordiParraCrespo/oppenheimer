import type { DiffLayout } from '@oppenheimer/design-system-web';
import type { LineCommentInput, PullRequestAddress } from '@oppenheimer/frontend-consumer';
import { PaneBar } from '@oppenheimer/frontend-web';
import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import type { PullRequestView } from '../lib/pull-request-search';
import { PullRequestBriefing } from '../sections/pull-request-briefing';
import { PullRequestChanges } from '../sections/pull-request-changes';
import { PullRequestDescription } from '../sections/pull-request-description';
import { PullRequestToolbar } from '../sections/pull-request-toolbar';

/**
 * A pull request: the bar and one of its three views. The review's pending
 * line comments are shared by two of them — written on Changes, posted from
 * Submit review — and the diff's layout is switched in the bar and drawn on
 * Changes, so both live here.
 *
 * The bar sits in the shell's slot above the page (`PaneBar`), so it stays put
 * while the view scrolls under it; each view is a page the shell frames at
 * the measure the route reads off `?view=`.
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
  const [layout, setLayout] = useState<DiffLayout>('unified');
  const setView = (next: PullRequestView) =>
    navigate({ to: '.', search: { view: next === 'description' ? undefined : next } });

  return (
    <>
      <PaneBar>
        <PullRequestToolbar
          address={address}
          view={view}
          onViewChange={setView}
          layout={layout}
          onLayoutChange={setLayout}
          pending={pending}
          onReviewSubmitted={() => setPending([])}
          onDiscardPending={() => setPending([])}
        />
      </PaneBar>
      {view === 'description' ? (
        <PullRequestDescription address={address} />
      ) : view === 'changes' ? (
        <PullRequestChanges
          address={address}
          layout={layout}
          pending={pending}
          onAddPending={(comment) => setPending((current) => [...current, comment])}
          onDiscardPending={(index) =>
            setPending((current) => current.filter((_, i) => i !== index))
          }
        />
      ) : (
        <PullRequestBriefing address={address} onReviewChanges={() => setView('changes')} />
      )}
    </>
  );
}
