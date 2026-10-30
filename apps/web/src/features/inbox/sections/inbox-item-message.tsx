import type { InboxItem } from '@oppenheimer/frontend-consumer';
import type { InboxCopy } from '@/features/inbox/lib/inbox-copy';
import { InboxApprovalCard } from '@/features/inbox/sections/inbox-approval-card';
import { InboxPullCard } from '@/features/inbox/sections/inbox-pull-card';
import { InboxRunCard } from '@/features/inbox/sections/inbox-run-card';
import { InboxSessionCard } from '@/features/inbox/sections/inbox-session-card';

/**
 * The item in the reading pane as its kind's message. Keyed by the item, so
 * the next one rises in fresh with its own answer state — a session by the
 * session instead, so a refused answer stays over the decision it now waits
 * on.
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
    case 'run':
      return <InboxRunCard key={item.key} item={item} copy={copy} from={from} age={age} />;
    case 'session':
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
}
