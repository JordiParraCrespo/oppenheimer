import { Button, Kbd, Textarea } from '@oppenheimer/design-system-web';
import { ArrowLeft, GitMerge, MessageSquare } from '@oppenheimer/design-system-web/icons';
import type { PullRequestEntity } from '@oppenheimer/frontend-consumer';
import {
  useMergePullRequest,
  useSubmitPullRequestReview,
} from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert, notifySuccess } from '@oppenheimer/frontend-web';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useReviewDeckKeys } from '../hooks/use-review-deck-keys';
import { DECK_VERB_LABEL, type DeckVerb, deckVerbs } from '../lib/review-deck';

/**
 * What can be done with the card on screen, each with its key, and then the
 * deck moves on (`onActed`): the reader never goes back to a list between two
 * pull requests.
 *
 * Which press does what is `deckVerbs`, decided once from whose pull request
 * it is. A merge is armed by its first press and made by the
 * second, since one key must not be all that stands before a merge. A refusal
 * from GitHub stays in the bar until the next press. The bar floats at the foot of the pane,
 * so a long card never hides it. The mutations and what is armed are
 * this section's, which the deck keys per card, so nothing carries over.
 */
export function ReviewActions({
  pull,
  onActed,
  onPass,
  onOpen,
}: {
  pull: PullRequestEntity;
  onActed: () => void;
  onPass: () => void;
  onOpen: () => void;
}) {
  const { t } = useTranslation();
  const [armed, setArmed] = useState(false);
  const [composing, setComposing] = useState(false);
  const [comment, setComment] = useState('');
  const verbs = deckVerbs(pull.scope);
  const blocked = pull.blocker ? t(`pullRequests.blocker.${pull.blocker}`) : undefined;

  // A refusal stays beside the actions (below), where it can be read again.
  const merge = useMergePullRequest({
    onSuccess: () => {
      notifySuccess('pullRequestMerged', { reference: pull.reference });
      onActed();
    },
  });
  const review = useSubmitPullRequestReview({
    onSuccess: ({ merged, autoMerge }, { review: sent }) => {
      notifySuccess(
        sent.verdict === 'approve'
          ? 'reviewApproved'
          : sent.verdict !== 'approve_and_merge'
            ? 'reviewSubmitted'
            : merged
              ? 'reviewApprovedMerged'
              : autoMerge
                ? 'reviewApprovedAutoMerge'
                : 'reviewApprovedWaiting',
      );
      onActed();
    },
  });
  const busy = merge.isPending || review.isPending;
  const running: DeckVerb | undefined = merge.isPending
    ? 'merge'
    : review.isPending
      ? review.variables?.review.verdict
      : undefined;
  const run = (verb: DeckVerb, body?: string) => {
    merge.reset();
    review.reset();
    if (verb === 'merge') merge.mutate({ address: pull.address });
    else review.mutate({ address: pull.address, review: { verdict: verb, body, comments: [] } });
  };

  // GitHub merges somebody else's once it can (auto-merge); yours only when nothing holds it.
  const canMerge = verbs.merges !== 'merge' || !blocked;
  const mergeNow = () => {
    if (busy || !canMerge) return;
    if (!armed) return setArmed(true);
    setArmed(false);
    run(verbs.merges);
  };
  const yes = () => {
    if (verbs.yes === verbs.merges) mergeNow();
    else if (!busy) run(verbs.yes);
  };
  const send = () => {
    if (!busy && comment.trim()) run(verbs.says, comment.trim());
  };

  useReviewDeckKeys({
    onYes: yes,
    onPass: busy ? undefined : onPass,
    onOpen: busy ? undefined : onOpen,
    onComment: () => setComposing(true),
    onMerge: mergeNow,
    onRelease: () => {
      setArmed(false);
      setComposing(false);
    },
  });

  const saysLabel = t(DECK_VERB_LABEL[verbs.says]);
  const mergeLabel = t(armed ? 'pullRequests.deck.confirmMerge' : DECK_VERB_LABEL[verbs.merges]);
  return (
    <div className="sticky bottom-4 z-10 flex flex-col gap-3 rounded-2xl border border-border-subtle bg-card p-3 shadow-lg">
      {composing ? (
        <div className="flex flex-col gap-2">
          <Textarea
            autoFocus
            rows={3}
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) send();
              if (event.key === 'Escape') setComposing(false);
            }}
            aria-label={saysLabel}
            placeholder={t('pullRequests.review.placeholder')}
          />
          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setComposing(false)}>
              {t('pullRequests.changes.cancel')}
            </Button>
            <Button
              size="sm"
              onClick={send}
              disabled={!comment.trim()}
              pending={running === verbs.says}
            >
              {saysLabel}
              <Kbd className="ml-1">⌘⏎</Kbd>
            </Button>
          </div>
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="secondary" onClick={onPass} disabled={busy}>
          <ArrowLeft />
          {t('pullRequests.deck.pass')}
          <Kbd className="ml-1">←</Kbd>
        </Button>
        <span className="flex-1" />
        <Button variant="ghost" onClick={() => setComposing(true)} disabled={busy}>
          <MessageSquare />
          {saysLabel}
          <Kbd className="ml-1">C</Kbd>
        </Button>
        {verbs.yes === verbs.merges ? null : (
          <Button
            variant="secondary"
            onClick={mergeNow}
            disabled={busy}
            pending={running === verbs.merges}
          >
            <GitMerge />
            {mergeLabel}
            <Kbd className="ml-1">M</Kbd>
          </Button>
        )}
        <Button
          onClick={yes}
          disabled={busy || (verbs.yes === verbs.merges && !canMerge)}
          pending={running === verbs.yes}
        >
          {verbs.yes === verbs.merges ? <GitMerge /> : null}
          {verbs.yes === verbs.merges ? mergeLabel : t(DECK_VERB_LABEL[verbs.yes])}
          <Kbd className="ml-1">→</Kbd>
        </Button>
      </div>
      <ErrorAlert
        error={merge.error ?? review.error}
        fallback={t(merge.error ? 'pullRequests.queue.mergeFailed' : 'pullRequests.review.failed')}
      />
      {blocked ? (
        <p className="m-0 px-1 text-right text-sm text-fg-muted">
          {t('pullRequests.deck.held', { reason: blocked })}
        </p>
      ) : null}
    </div>
  );
}
