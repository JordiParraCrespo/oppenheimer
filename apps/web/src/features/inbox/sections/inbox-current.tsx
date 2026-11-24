import {
  IconButton,
  InboxClear,
  InboxDeck,
  InboxDock,
  InboxToolbar,
  inboxDeckAnswer,
  useIsMobile,
  useNow,
} from '@oppenheimer/design-system-web';
import { ChevronLeft } from '@oppenheimer/design-system-web/icons';
import { useSessions } from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert, formatAge } from '@oppenheimer/frontend-web';
import { Link } from '@tanstack/react-router';
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useInboxDeck } from '@/features/inbox/hooks/use-inbox-deck';
import { useInboxKeys } from '@/features/inbox/hooks/use-inbox-keys';
import { useInboxListing } from '@/features/inbox/hooks/use-inbox-listing';
import { useInboxMarks } from '@/features/inbox/hooks/use-inbox-marks';
import { useMarkRead } from '@/features/inbox/hooks/use-inbox-read';
import { useFollowNext } from '@/features/inbox/hooks/use-inbox-visit';
import { inboxCardKey } from '@/features/inbox/lib/inbox-card-key';
import { inboxCopy, inboxFrom } from '@/features/inbox/lib/inbox-copy';
import { canPutAway } from '@/features/inbox/lib/inbox-put-away';
import { InboxItemMessage } from '@/features/inbox/sections/inbox-item-message';

/**
 * The deck: a bar with the item's place in the list and how much of the visit
 * is cleared; under it the item as a card on the stack of what is left, with
 * only its answers, numbered; under that the dock, Previous, Done and Next —
 * or "You're all caught up". It takes its item from the same list the column
 * draws, under the same filter and search, and showing it marks it read.
 *
 * Done (the dock, E, a swipe right) sends the card off and moves on to the
 * item after it; answering it on the card does too, once the answer lands
 * (`currentItem` follows `following`). A card that waits on an answer has no
 * Done (`canPutAway`). Previous and Next (K and J, the arrows, a swipe left)
 * go through the stack without putting anything away, and 1–9 press the
 * card's numbered answers.
 */
export function InboxCurrent() {
  const { t } = useTranslation();
  const now = useNow(60_000);
  const { inbox, search, open, visit, current: item } = useInboxListing(now);
  const marks = useInboxMarks();
  const { data: running } = useSessions({
    select: (rows) => rows.filter((session) => session.isLive).length,
  });
  const deck = useRef<HTMLDivElement>(null);
  const { leaving, putAway } = useInboxDeck(item?.key ?? null);

  const index = item ? open.indexOf(item) : -1;
  const next = index >= 0 ? (open[index + 1]?.key ?? null) : null;
  const previous = index > 0 ? (open[index - 1]?.key ?? null) : null;
  useFollowNext(item?.key ?? null, next);

  const copy = item ? inboxCopy(item, t) : null;
  useMarkRead(item?.key ?? null, search.item !== null);

  const doneable = item ? canPutAway(item) : false;
  const done = () => {
    if (!item || !doneable) return;
    putAway(item.key, 'right', () => {
      // At the end of the stack the address keeps naming the item: on a phone
      // the deck stays open, to say it is clear or show a write that failed.
      search.advance(next ?? item.key);
      marks.apply('done', item);
    });
  };
  const toNext = () => search.advance(next ?? open[0]?.key ?? null);
  const toPrevious = () => search.advance(previous ?? open.at(-1)?.key ?? null);
  // Swiped left, the card goes off and the next comes up; this one stays.
  const swipeNext = () => {
    if (!item) return;
    putAway(item.key, 'left', toNext);
  };
  // On a phone the deck is hidden until an item is opened: no key acts on a
  // card the reader cannot see.
  const phone = useIsMobile();
  const shown = !phone || search.item !== null;
  useInboxKeys(
    item && shown
      ? {
          onDone: done,
          onNext: toNext,
          onPrevious: toPrevious,
          onAnswer: (n) => {
            // A card on its way out takes no answer.
            if (leaving) return false;
            const answer = inboxDeckAnswer(deck.current, n);
            answer?.click();
            return answer !== null;
          },
        }
      : null,
  );

  const back = (
    <IconButton
      className="md:hidden"
      aria-label={t('inbox.pane.back')}
      render={<Link to="/inbox" search={(previous) => ({ ...previous, item: undefined })} />}
    >
      <ChevronLeft />
    </IconButton>
  );
  const projectName = (id: string) => inbox.projects.find((project) => project.id === id)?.name;
  const cleared = visit.cleared.length;
  const progress = cleared ? cleared / (cleared + inbox.open.length) : undefined;
  const errors = (
    <>
      {inbox.error ? (
        <ErrorAlert error={inbox.error} fallback={t('inbox.list.failed')} className="mx-8 mt-6" />
      ) : null}
      {marks.error ? (
        <ErrorAlert
          error={marks.error}
          fallback={t('inbox.list.markFailed')}
          onDismiss={marks.dismiss}
          className="mx-8 mt-6"
        />
      ) : null}
    </>
  );

  if (!item || !copy) {
    const still = running
      ? t('inbox.pane.clearRunning', { count: running })
      : t('inbox.pane.clear');
    return (
      <>
        {/* On a phone the list stays hidden while the address names an item,
            so the way back to it outlives the last item leaving. */}
        {search.item !== null ? (
          <InboxToolbar aria-label={t('inbox.pane.toolbar')} className="md:hidden">
            {back}
          </InboxToolbar>
        ) : null}
        {errors}
        <InboxClear title={t('inbox.pane.clearTitle')}>
          {cleared ? `${t('inbox.pane.cleared', { count: cleared })} ${still}` : still}
        </InboxClear>
      </>
    );
  }

  const from = inboxFrom(item, copy.source, projectName);
  // "6m ago", but "now" alone for what came in this minute.
  const age =
    now - item.since.getTime() < 60_000
      ? formatAge(item.since, now, t)
      : t('inbox.pane.ago', { age: formatAge(item.since, now, t) });
  const several = open.length > 1;
  return (
    <>
      <InboxToolbar
        aria-label={t('inbox.pane.toolbar')}
        position={t('inbox.pane.position', { n: index + 1, total: open.length })}
        progress={progress}
      >
        {back}
      </InboxToolbar>
      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
        {errors}
        {/* Keyed by the item (`inboxCardKey`): the next card starts with no
            drag, tilt or stamp left on it, whether or not the last one left
            with an animation. */}
        <InboxDeck
          key={inboxCardKey(item)}
          ref={deck}
          behind={open.length - 1}
          leaving={leaving}
          onSwipe={(direction) => (direction === 'right' ? done() : swipeNext())}
          swipeLabels={{
            right: doneable ? t('inbox.dock.done') : undefined,
            left: several ? t('inbox.dock.next') : undefined,
          }}
        >
          <InboxItemMessage item={item} copy={copy} from={from} age={age} />
        </InboxDeck>
        <InboxDock
          aria-label={t('inbox.dock.label')}
          previous={{
            label: t('inbox.dock.previous'),
            keyHint: 'K',
            onClick: toPrevious,
            disabled: !several,
          }}
          next={{ label: t('inbox.dock.next'), keyHint: 'J', onClick: toNext, disabled: !several }}
          done={
            doneable
              ? { label: t('inbox.dock.done'), keyHint: 'E', onClick: done, disabled: !!leaving }
              : undefined
          }
        />
      </div>
    </>
  );
}
