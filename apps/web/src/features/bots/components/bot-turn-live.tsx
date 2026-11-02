import { TraceLive } from '@oppenheimer/design-system-web';
import type { BotToolStep } from '@oppenheimer/frontend-consumer';
import type { BotSubagentProgress } from '@oppenheimer/shared/schemas/bot';
import { useTranslation } from 'react-i18next';
import { BotSubagentsLive } from '@/features/bots/components/bot-subagents-live';
import { BotTurnClock } from '@/features/bots/components/bot-turn-clock';
import { liveLabel } from '@/features/bots/lib/tool-activity';

/**
 * The turn in flight, after what it has done so far (the Bots frame's live
 * line): Waiting while it queues, that it waits on its provider while the
 * engine retries a refused call ("Anthropic is limiting requests, retrying…"),
 * Thinking before its first word or call, what the running call is doing
 * ("Searching the web for …"), Writing while its words stream; its clock
 * beside it once it has started. When the running call is a `delegate`, its
 * children hang under the line as they work, and the line counts the ones
 * done.
 */
export function BotTurnLive({
  queued,
  step,
  subagents,
  writing,
  waitingOn,
  provider,
  since,
}: {
  queued: boolean;
  /** The call running now, if one is. */
  step: BotToolStep | undefined;
  /** Where that call's children are, when it is a `delegate` the stream has told of. */
  subagents: readonly BotSubagentProgress[] | undefined;
  /** Whether text is streaming in. */
  writing: boolean;
  /** Why the engine waits to try a refused call again; none while it does not. */
  waitingOn?: 'rate_limit' | 'unavailable';
  /** The provider's name, for the wait. */
  provider: string;
  since: Date | null;
}) {
  const { t } = useTranslation();
  const label = liveLabel({ queued, step, subagents, writing });
  const text =
    !queued && waitingOn
      ? t(`bots.chat.turn.retrying.${waitingOn}`, { provider })
      : t(label.key, label.values);
  return (
    <>
      <TraceLive elapsed={since && !queued ? <BotTurnClock since={since} /> : undefined}>
        {text}
      </TraceLive>
      {subagents?.length ? <BotSubagentsLive runs={subagents} /> : null}
    </>
  );
}
