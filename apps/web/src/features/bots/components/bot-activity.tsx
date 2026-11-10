import type { BotToolStep } from '@oppenheimer/frontend-consumer';
import { BotMailDraftCard } from '@/features/bots/components/bot-mail-draft-card';
import { BotTrace } from '@/features/bots/components/bot-trace';
import { OpenSessionButton } from '@/features/bots/components/open-session-button';
import { useToolCallsShownInChat } from '@/features/bots/hooks/use-tool-calls-shown';

/**
 * A run of the bot's tool calls in its chat: the trace, then what any call
 * made that the reader should see in full, under it (a saved draft's card).
 * What a step made is drawn here, so the turn maps messages and nothing else.
 * With the tool calls hidden (the wrench in the chat's bar), the trace goes
 * and what the calls made stays: a session one started keeps its Open
 * session, a draft its card.
 */
export function BotActivity({
  steps,
  live = false,
}: {
  steps: readonly BotToolStep[];
  /** The turn is still running. */
  live?: boolean;
}) {
  const shown = useToolCallsShownInChat();
  const sessions = shown ? [] : [...new Set(steps.flatMap((step) => step.sessionId ?? []))];
  const drafts = steps.flatMap((step) =>
    step.mailDraft ? [<BotMailDraftCard key={step.callId} draft={step.mailDraft} />] : [],
  );
  if (!shown && sessions.length === 0 && drafts.length === 0) return null;
  return (
    <div className="flex flex-col gap-3">
      {shown ? <BotTrace steps={steps} live={live} /> : null}
      {sessions.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {sessions.map((sessionId) => (
            <OpenSessionButton key={sessionId} sessionId={sessionId} />
          ))}
        </div>
      ) : null}
      {drafts}
    </div>
  );
}
