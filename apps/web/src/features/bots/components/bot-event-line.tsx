import { TranscriptDivider } from '@oppenheimer/design-system-web';
import { Check, CircleAlert, X } from '@oppenheimer/design-system-web/icons';
import { eventLine } from '@/features/bots/lib/chat-turns';

/**
 * What Oppenheimer told the bot for you, as a trace line in the chat (the AI
 * Elements export's decided Confirmation): "Ana approved: Start Claude Code
 * on build-02…" with a check, a denial in red with a cross, a call that ran
 * and failed in red. Never a bubble from you: you did not write it.
 */
export function BotEventLine({ content }: { content: string }) {
  const { headline, outcome } = eventLine(content);
  const icon =
    outcome === 'approved' ? (
      <Check />
    ) : outcome === 'failed' ? (
      <CircleAlert />
    ) : outcome === 'denied' ? (
      <X />
    ) : null;
  return (
    <TranscriptDivider
      icon={icon}
      tone={outcome === 'approved' || outcome === null ? 'default' : 'danger'}
    >
      <span className="max-w-xl truncate" title={content}>
        {headline}
      </span>
    </TranscriptDivider>
  );
}
