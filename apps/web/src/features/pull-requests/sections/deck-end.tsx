import { Button, EmptyState } from '@oppenheimer/design-system-web';
import { CircleCheck, ListChecks, RotateCcw } from '@oppenheimer/design-system-web/icons';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { useReviewDeckKeys } from '../hooks/use-review-deck-keys';
import type { QueueSearch } from '../lib/queue-search';

/**
 * Where the deck stands with no card: past the last one, or on one that left
 * the queue. ← goes back to the last card; the deck's other keys belong to a
 * card and are not bound here.
 */
export function DeckEnd({
  gone,
  queueSearch,
  onRestart,
  onPrevious,
}: {
  gone: boolean;
  queueSearch: QueueSearch;
  onRestart: () => void;
  onPrevious?: () => void;
}) {
  const { t } = useTranslation();
  useReviewDeckKeys({ onPrevious });
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
            <Button variant="secondary" onClick={onRestart}>
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
