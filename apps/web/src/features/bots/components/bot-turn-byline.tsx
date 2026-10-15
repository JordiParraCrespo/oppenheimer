import { type AvatarColor, BotAvatar } from '@oppenheimer/design-system-web';
import { useTranslation } from 'react-i18next';
import { BotTurnClock } from '@/features/bots/components/bot-turn-clock';
import type { TurnPhase } from '@/features/bots/lib/chat-turns';

/**
 * Who answers, over the answer: the bot's face and name, then where its turn
 * is while it runs, breathing, with its clock ("Thinking 00:03" before the
 * first word, "Working 00:12" after, "Waiting" while it queues). Once it has
 * ended, the time it ended shows on hover.
 */
export function BotTurnByline({
  name,
  initials,
  color,
  phase,
  since,
  time,
}: {
  name: string;
  initials: string;
  color: AvatarColor;
  /** `null` for a turn older than the page, whose state the chat does not hold. */
  phase: TurnPhase | null;
  /** When the running turn started, for its clock. */
  since: Date | null;
  /** When it ended, "12:34". */
  time: string | undefined;
}) {
  const { t } = useTranslation();
  const running = phase === 'thinking' || phase === 'working';
  return (
    <div data-slot="bot-turn-byline" className="flex min-h-6 items-center gap-2 text-sm">
      <BotAvatar option={{ initials }} size={22} color={color} />
      <span className="font-medium text-fg">{name}</span>
      {phase === 'queued' ? (
        <span role="status" className="text-fg-muted motion-safe:animate-shimmer">
          {t('bots.chat.turn.queued')}
        </span>
      ) : null}
      {running ? (
        <span role="status" className="inline-flex items-center gap-1.5 text-fg-muted">
          <span className="motion-safe:animate-shimmer">
            {phase === 'thinking' ? t('bots.chat.turn.thinking') : t('bots.chat.turn.working')}
          </span>
          {since ? (
            <span className="figures font-mono text-xs text-fg-subtle">
              <BotTurnClock since={since} />
            </span>
          ) : null}
        </span>
      ) : null}
      {time ? (
        <span className="figures font-mono text-micro text-fg-subtle opacity-0 transition-opacity duration-fast group-hover/reply:opacity-100 group-focus-within/reply:opacity-100">
          {time}
        </span>
      ) : null}
    </div>
  );
}
