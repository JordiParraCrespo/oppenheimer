import { InboxClear, InboxGreeting, InboxLogLine, useNow } from '@oppenheimer/design-system-web';
import { useSessions, useSuspenseInbox } from '@oppenheimer/frontend-consumer/react';
import { dateFormatter, ErrorAlert, formatAge, useLocale } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import { useInboxKeys } from '@/features/inbox/hooks/use-inbox-keys';
import { useInboxMarks } from '@/features/inbox/hooks/use-inbox-marks';
import { useInboxSearch } from '@/features/inbox/hooks/use-inbox-search';
import { useInboxVisit } from '@/features/inbox/hooks/use-inbox-visit';
import { inboxCopy, inboxFrom } from '@/features/inbox/lib/inbox-copy';
import { currentItem } from '@/features/inbox/lib/inbox-current';
import { listedItems } from '@/features/inbox/lib/inbox-filter';
import { InboxApprovalCard } from '@/features/inbox/sections/inbox-approval-card';
import { InboxPullCard } from '@/features/inbox/sections/inbox-pull-card';
import { InboxRunCard } from '@/features/inbox/sections/inbox-run-card';
import { InboxSessionCard } from '@/features/inbox/sections/inbox-session-card';

/** "Good morning", by the reader's own hour. */
function greetingKey(now: number): 'morning' | 'afternoon' | 'evening' {
  const hour = new Date(now).getHours();
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 19) return 'afternoon';
  return 'evening';
}

/**
 * The pane (`29-inbox.md` §5): a greeting with what is going on, the log of
 * what was done this visit, and the item in hand as one card with its
 * answers — or "You're clear". It takes its item from the same list the
 * sidebar draws, under the same filter; E and L act on it.
 */
export function InboxCurrent() {
  const { t } = useTranslation();
  const locale = useLocale();
  const now = useNow(60_000);
  const inbox = useSuspenseInbox(now);
  const visit = useInboxVisit();
  const search = useInboxSearch();
  const marks = useInboxMarks();
  const { data: running } = useSessions({
    select: (rows) => rows.filter((session) => session.isLive).length,
  });

  const { open } = listedItems(inbox, visit, search.filter, search.showDone);
  const item = currentItem(open, search.item, visit);
  const copy = item ? inboxCopy(item, t) : null;
  useInboxKeys(
    item && copy
      ? { onDone: () => marks.done(item, copy.short), onLow: () => marks.toggleLow(item) }
      : null,
  );

  const projectName = (id: string) => inbox.projects.find((project) => project.id === id)?.name;
  const clock = dateFormatter(locale, { hour: '2-digit', minute: '2-digit' });
  // No running line before the sessions answer, or when none run.
  const runningLine = running ? t('inbox.pane.running', { count: running }) : '';
  const needs = inbox.open.length;
  // Keyed by the item, so the next one rises in fresh, with its own answer state.
  const card =
    item && copy
      ? (() => {
          const from = inboxFrom(item, copy.source, projectName);
          const age = formatAge(item.since, now, t);
          switch (item.kind) {
            case 'approval':
              return (
                <InboxApprovalCard key={item.key} item={item} copy={copy} from={from} age={age} />
              );
            case 'pull':
              return <InboxPullCard key={item.key} item={item} copy={copy} from={from} age={age} />;
            case 'run':
              return <InboxRunCard key={item.key} item={item} copy={copy} from={from} age={age} />;
            case 'session':
              // By the session, so a refused answer stays over the decision it now waits on.
              return (
                <InboxSessionCard
                  key={`session:${item.session.id}`}
                  item={item}
                  copy={copy}
                  from={from}
                  age={age}
                />
              );
          }
        })()
      : null;

  return (
    <div className="flex flex-col gap-4.5 pt-6">
      <InboxGreeting title={t(`inbox.pane.greeting.${greetingKey(now)}`)}>
        {[runningLine, needs ? t('inbox.pane.needs', { count: needs }) : t('inbox.pane.nothing')]
          .filter(Boolean)
          .join(' ')}
      </InboxGreeting>

      {visit.log.map((entry) => (
        <InboxLogLine key={entry.id} time={clock.format(entry.at)}>
          {entry.text}
        </InboxLogLine>
      ))}

      {inbox.error ? <ErrorAlert error={inbox.error} fallback={t('inbox.list.failed')} /> : null}
      {marks.error ? (
        <ErrorAlert
          error={marks.error}
          fallback={t('inbox.list.markFailed')}
          onDismiss={marks.dismiss}
        />
      ) : null}

      {item && copy ? (
        card
      ) : (
        <InboxClear title={t('inbox.pane.clearTitle')}>
          {running ? t('inbox.pane.clearRunning', { count: running }) : t('inbox.pane.clear')}
        </InboxClear>
      )}
    </div>
  );
}
