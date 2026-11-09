import { Button, EmptyState } from '@oppenheimer/design-system-web';
import { CircleCheck, ListChecks, RotateCcw } from '@oppenheimer/design-system-web/icons';
import { useSuspensePullRequestQueue } from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert } from '@oppenheimer/frontend-web';
import { Link, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useReviewSearch } from '../hooks/use-review-search';
import { pullRequestLink } from '../lib/pull-request-search';
import { filterQueue } from '../lib/queue-filter';
import { DECK_END, deckKey, deckPosition } from '../lib/review-deck';
import { BriefAhead } from './brief-ahead';
import { QueueEmpty } from './queue-empty';
import { ReviewActions } from './review-actions';
import { ReviewCard } from './review-card';

/**
 * The review deck: the queue one pull request at a time, in the queue's own
 * order (the deepest lane first, then the longest wait). Each card is acted
 * on or passed and the next one takes its place, until there is none left.
 *
 * A card is the high level only, at the pane's width: what the pull request
 * is and what holds it. The diff is one link away (Review in depth), never
 * on the card. The queue is read here because the card, its actions and the
 * count all stand on the same row. The next card's brief is asked for while this one
 * is read, so moving on does not wait for a model. Opening a card's changes
 * leaves the deck with its address in the history, and the pull request's
 * Back returns to this card. A card that has left the queue (it merged) is
 * never replaced by another under the same actions: the deck says it left.
 */
export function ReviewDeck() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { scope, filters, at, setAt } = useReviewSearch();
  const { data, error } = useSuspensePullRequestQueue(scope);
  const rows = filterQueue(data.items, filters);
  // Opened with no card named (the sidebar's link), the deck stands on the
  // first card it drew, by name: a refetch that puts another pull request
  // first must not slide it under the same actions.
  const [first] = useState(() => (rows[0] ? deckKey(rows[0]) : undefined));
  const { current, next, index, gone } = deckPosition(rows, at ?? first);

  const queueSearch = { ...filters, scope: scope === 'all' ? undefined : scope };
  if (!rows.length) {
    return (
      <>
        <ErrorAlert error={error} fallback={t('pullRequests.queue.loadFailed')} />
        <QueueEmpty queue={scope} />
      </>
    );
  }
  if (!current) {
    return (
      <div className="w-full rounded-xl bg-card py-10">
        <EmptyState>
          <EmptyState.Header>
            <EmptyState.Media variant="icon">
              <CircleCheck />
            </EmptyState.Media>
            <EmptyState.Title>
              {t(gone ? 'pullRequests.deck.goneTitle' : 'pullRequests.deck.doneTitle')}
            </EmptyState.Title>
            <EmptyState.Description>
              {gone ? null : t('pullRequests.deck.doneHint')}
            </EmptyState.Description>
          </EmptyState.Header>
          <EmptyState.Content>
            <div className="flex flex-wrap justify-center gap-2">
              <Button
                variant="secondary"
                onClick={() => setAt(rows[0] ? deckKey(rows[0]) : undefined)}
              >
                <RotateCcw />
                {t(gone ? 'pullRequests.deck.fromTop' : 'pullRequests.deck.again')}
              </Button>
              <Button
                variant="secondary"
                nativeButton={false}
                render={<Link to="/pulls" search={queueSearch} />}
              >
                <ListChecks />
                {t('pullRequests.detail.back')}
              </Button>
            </div>
          </EmptyState.Content>
        </EmptyState>
      </div>
    );
  }

  const moveOn = () => setAt(next ? deckKey(next) : DECK_END);
  // The way from a card to its diff: the address of the card rides in the
  // history, so the pull request's Back returns to it.
  const depth = {
    ...pullRequestLink(current.address, 'changes'),
    state: {
      pullsReturn: { to: 'deck' as const, search: { ...queueSearch, at: deckKey(current) } },
    },
  };
  const openDepth = () => navigate(depth);
  return (
    <div className="flex w-full flex-col gap-4">
      <ErrorAlert error={error} fallback={t('pullRequests.queue.loadFailed')} />
      <div className="flex items-center gap-3 text-sm text-fg-muted">
        <span className="figures">
          {t('pullRequests.deck.position', { at: index + 1, total: rows.length })}
        </span>
        <span
          className="h-1 flex-1 overflow-hidden rounded-pill bg-control"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={rows.length}
          aria-valuenow={index}
          aria-label={t('pullRequests.deck.position', { at: index + 1, total: rows.length })}
        >
          <span
            className="block h-full rounded-pill bg-primary transition-[width] duration-200"
            style={{ width: `${(index / rows.length) * 100}%` }}
          />
        </span>
      </div>
      {next ? <BriefAhead key={deckKey(next)} address={next.address} /> : null}
      <div key={deckKey(current)} className="flex animate-appear flex-col gap-4">
        <ReviewCard pull={current} depth={depth} />
        <ReviewActions pull={current} onActed={moveOn} onPass={moveOn} onOpen={openDepth} />
      </div>
    </div>
  );
}
