import {
  IconButton,
  InboxClear,
  InboxDeck,
  InboxDeckKeys,
  InboxToolbar,
  inboxDeckAnswer,
  useNow,
} from '@oppenheimer/design-system-web';
import {
  Check,
  ChevronLeft,
  Clock,
  TrendingDown,
  TrendingUp,
  X,
} from '@oppenheimer/design-system-web/icons';
import { useSessions } from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert, formatAge } from '@oppenheimer/frontend-web';
import { Link } from '@tanstack/react-router';
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { InboxDeckContext, useInboxDeck } from '@/features/inbox/hooks/use-inbox-deck';
import { useInboxKeys } from '@/features/inbox/hooks/use-inbox-keys';
import { useInboxListing } from '@/features/inbox/hooks/use-inbox-listing';
import { useInboxMarks } from '@/features/inbox/hooks/use-inbox-marks';
import { useMarkRead } from '@/features/inbox/hooks/use-inbox-read';
import { useFollowNext } from '@/features/inbox/hooks/use-inbox-visit';
import { inboxCopy, inboxFrom } from '@/features/inbox/lib/inbox-copy';
import type { InboxMarkActionName } from '@/features/inbox/lib/inbox-mark-actions';
import { inboxVisit } from '@/features/inbox/lib/inbox-visit';
import { InboxItemMessage } from '@/features/inbox/sections/inbox-item-message';

/**
 * The deck: a toolbar that marks the item in hand done, snoozes it until
 * tomorrow, deprioritizes or deletes it, with its place in the list and how
 * much of the visit is cleared; under it the item as a card on the stack of
 * what is left, and the keys that answer it — or "You're all caught up". It
 * takes its item from the same list the column draws, under the same filter
 * and search, and showing it marks it read.
 *
 * Putting a card away (its toolbar, E and S, a swipe, Later) sends it off
 * and moves on to the item after it; answering it on the card does too, once
 * the answer lands (`currentItem` follows `next`). J and K, or the arrows,
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
  // Only for the item the address names (or the first, when it names none):
  // a stand-in for one that left was picked by `next` itself.
  useFollowNext(item && (search.item === null || search.item === item.key) ? next : undefined);

  const copy = item ? inboxCopy(item, t) : null;
  useMarkRead(item?.key ?? null, search.item !== null);

  const away = (action: InboxMarkActionName, exit: 'right' | 'up') => {
    if (!item) return;
    putAway(item.key, exit, () => {
      search.advance(next);
      marks.apply(action, item);
    });
  };
  const later = () => {
    if (!item) return;
    putAway(item.key, 'left', () => {
      inboxVisit.later(item.key);
      search.advance(next);
    });
  };
  useInboxKeys(
    item
      ? {
          onDone: () => away('done', 'right'),
          onLow: () => marks.apply('toggleLow', item),
          onSnooze: () => away('snoozeTomorrow', 'up'),
          onNext: () => search.advance(next ?? open[0]?.key ?? null),
          onPrevious: () => search.advance(previous ?? open.at(-1)?.key ?? null),
          onAnswer: (n) => {
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
  return (
    <InboxDeckContext value={putAway}>
      <InboxToolbar
        aria-label={t('inbox.pane.toolbar')}
        position={t('inbox.pane.position', { n: index + 1, total: open.length })}
        progress={progress}
      >
        {back}
        <IconButton aria-label={t('inbox.menu.done')} onClick={() => away('done', 'right')}>
          <Check />
        </IconButton>
        <IconButton
          aria-label={t('inbox.menu.snoozeTomorrow')}
          onClick={() => away('snoozeTomorrow', 'up')}
        >
          <Clock />
        </IconButton>
        <IconButton
          aria-label={item.low ? t('inbox.menu.restore') : t('inbox.menu.low')}
          onClick={() => marks.apply('toggleLow', item)}
        >
          {item.low ? <TrendingUp /> : <TrendingDown />}
        </IconButton>
        <IconButton aria-label={t('inbox.menu.delete')} onClick={() => away('remove', 'up')}>
          <X />
        </IconButton>
      </InboxToolbar>
      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
        {errors}
        <InboxDeck
          ref={deck}
          behind={open.length - 1}
          leaving={leaving}
          onSwipe={(direction) => (direction === 'right' ? away('done', 'right') : later())}
          swipeLabels={{ right: t('inbox.deck.swipeDone'), left: t('inbox.deck.swipeLater') }}
        >
          <InboxItemMessage item={item} copy={copy} from={from} age={age} />
        </InboxDeck>
        <InboxDeckKeys
          keys={[
            { keys: ['1–9'], label: t('inbox.deck.keys.answer') },
            { keys: ['E'], label: t('inbox.deck.keys.done') },
            { keys: ['S'], label: t('inbox.deck.keys.snooze') },
            { keys: ['J', 'K'], label: t('inbox.deck.keys.move') },
          ]}
          touch={t('inbox.deck.touch')}
        />
      </div>
    </InboxDeckContext>
  );
}
