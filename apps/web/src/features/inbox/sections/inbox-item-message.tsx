import type { InboxItem } from '@oppenheimer/frontend-consumer';
import { inboxCardKey } from '@/features/inbox/lib/inbox-card-key';
import type { InboxCopy } from '@/features/inbox/lib/inbox-copy';
import { InboxApprovalCard } from '@/features/inbox/sections/inbox-approval-card';
import { InboxBotNoticeCard } from '@/features/inbox/sections/inbox-bot-notice-card';
import { InboxNoticeCard } from '@/features/inbox/sections/inbox-notice-card';
import { InboxPullCard } from '@/features/inbox/sections/inbox-pull-card';
import { InboxReportCard } from '@/features/inbox/sections/inbox-report-card';
import { InboxRunCard } from '@/features/inbox/sections/inbox-run-card';
import { InboxSessionCard } from '@/features/inbox/sections/inbox-session-card';
import { InboxTaskCard } from '@/features/inbox/sections/inbox-task-card';

/**
 * The item in the reading pane as its kind's message, keyed as the deck is
 * (`inboxCardKey`): the next one rises in fresh with its own answer state.
 */
export function InboxItemMessage({
  item,
  copy,
  from,
  age,
}: {
  item: InboxItem;
  copy: InboxCopy;
  from: string;
  age: string;
}) {
  switch (item.kind) {
    case 'approval':
      return <InboxApprovalCard key={item.key} item={item} copy={copy} from={from} age={age} />;
    case 'pull':
      return <InboxPullCard key={item.key} item={item} copy={copy} from={from} age={age} />;
    case 'notice':
      return <InboxNoticeCard key={item.key} item={item} copy={copy} from={from} age={age} />;
    case 'botNotice':
      return (
        <InboxBotNoticeCard
          key={inboxCardKey(item)}
          item={item}
          copy={copy}
          from={from}
          age={age}
        />
      );
    case 'run':
      return <InboxRunCard key={item.key} item={item} copy={copy} from={from} age={age} />;
    case 'report':
      return <InboxReportCard key={item.key} item={item} copy={copy} from={from} age={age} />;
    case 'task':
      return <InboxTaskCard key={item.key} item={item} copy={copy} from={from} age={age} />;
    case 'session':
      return (
        <InboxSessionCard key={inboxCardKey(item)} item={item} copy={copy} from={from} age={age} />
      );
  }
}
