import { TraceLive } from '@oppenheimer/design-system-web';
import type { BotToolStep } from '@oppenheimer/frontend-consumer';
import type { BotSubagentProgress } from '@oppenheimer/shared/schemas/bot';
import { useTranslation } from 'react-i18next';
import { BotSubagentsLive } from '@/features/bots/components/bot-subagents-live';
import { BotTurnClock } from '@/features/bots/components/bot-turn-clock';
import { liveLabel } from '@/features/bots/lib/tool-activity';

/**
 * The turn in flight, after what it has done so far (the Bots frame's live
 * line): Waiting while it queues, Thinking before its first word or call,
 * what the running call is doing ("Searching the web for …"), Writing while
 * its words stream; its clock beside it once it has started. When the
 * running call is a `delegate`, its children hang under the line as they
 * work, and the line counts the ones done.
 */
export function BotTurnLive({
  queued,
  step,
  subagents,
  writing,
  since,
}: {
  queued: boolean;
  /** The call running now, if one is. */
  step: BotToolStep | undefined;
  /** Where that call's children are, when it is a `delegate` the stream has told of. */
  subagents: readonly BotSubagentProgress[] | undefined;
  /** Whether text is streaming in. */
  writing: boolean;
  since: Date | null;
}) {
  const { t } = useTranslation();
  const label = liveLabel({ queued, step, subagents, writing });
  return (
    <>
      <TraceLive elapsed={since && !queued ? <BotTurnClock since={since} /> : undefined}>
        {t(label.key, label.values)}
      </TraceLive>
      {subagents?.length ? <BotSubagentsLive runs={subagents} /> : null}
    </>
  );
}
