import { Button, EmptyState } from '@oppenheimer/design-system-web';
import { CircleCheck, ListChecks, RotateCcw } from '@oppenheimer/design-system-web/icons';
import { useSuspensePullRequestQueue } from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert } from '@oppenheimer/frontend-web';
import { Link, useNavigate } from '@tanstack/react-router';
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
 * The queue is read here because the card, its actions and the count all
 * stand on the same row. The next card's brief is asked for while this one
 * is read, so moving on does not wait for a model. Opening a card's changes
 * leaves the deck with its address in the history, and the pull request's
 * Back returns to this card.
 */
export function ReviewDeck() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { scope, filters, at, setAt } = useReviewSearch();
  const { data, error } = useSuspensePullRequestQueue(scope);
  const rows = filterQueue(data.items, filters);
  const { current, next, index } = deckPosition(rows, at);

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
      <div className="mx-auto w-full max-w-4xl rounded-xl bg-card py-10">
        <EmptyState>
          <EmptyState.Header>
            <EmptyState.Media variant="icon">
              <CircleCheck />
            </EmptyState.Media>
            <EmptyState.Title>{t('pullRequests.deck.doneTitle')}</EmptyState.Title>
            <EmptyState.Description>
              {t('pullRequests.deck.doneHint', { count: rows.length })}
            </EmptyState.Description>
          </EmptyState.Header>
          <EmptyState.Content>
            <div className="flex flex-wrap justify-center gap-2">
              <Button variant="secondary" onClick={() => setAt(undefined)}>
                <RotateCcw />
                {t('pullRequests.deck.again')}
              </Button>
              <Button
                variant="secondary"
                nativeButton={false}
                render={<Link to="/pulls" search={queueSearch} />}
              >
                <ListChecks />
                {t('pullRequests.deck.toQueue')}
              </Button>
            </div>
          </EmptyState.Content>
        </EmptyState>
      </div>
    );
  }

  const moveOn = () => setAt(next ? deckKey(next) : DECK_END);
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
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
          aria-label={t('pullRequests.deck.progress')}
        >
          <span
            className="block h-full rounded-pill bg-primary transition-[width] duration-200"
            style={{ width: `${(index / rows.length) * 100}%` }}
          />
        </span>
      </div>
      {next ? <BriefAhead key={deckKey(next)} address={next.address} /> : null}
      <div key={deckKey(current)} className="flex animate-appear flex-col gap-4">
        <ReviewCard pull={current} />
        <ReviewActions
          pull={current}
          onActed={moveOn}
          onPass={moveOn}
          onOpen={() =>
            navigate({
              ...pullRequestLink(current.address, 'changes'),
              state: { pullsDeck: { ...queueSearch, at: deckKey(current) } },
            })
          }
        />
      </div>
    </div>
  );
}
