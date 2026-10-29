import type { BotToolStep } from '@oppenheimer/frontend-consumer';
import { BotMailDraftCard } from '@/features/bots/components/bot-mail-draft-card';
import { BotTrace } from '@/features/bots/components/bot-trace';

/**
 * A run of the bot's tool calls in its chat: the trace, then what any call
 * made that the reader should see in full, under it (a saved draft's card).
 * What a step made is drawn here, so the turn maps messages and nothing else.
 */
export function BotActivity({ steps }: { steps: readonly BotToolStep[] }) {
  return (
    <div className="flex flex-col gap-3">
      <BotTrace steps={steps} />
      {steps.map((step) =>
        step.mailDraft ? <BotMailDraftCard key={step.callId} draft={step.mailDraft} /> : null,
      )}
    </div>
  );
}
