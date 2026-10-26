import { useBotRoomLeft } from '@oppenheimer/frontend-consumer/react';
import { ChatUsage } from '@oppenheimer/frontend-web';

/**
 * The bot's room left, beside its engine chips (`25-bots.md` §3): the
 * context its newest answer held, against the model's window when the engine
 * said one, and a ChatGPT sign-in's 5-hour and weekly windows. A bot on an
 * API key has no plan windows; one that has not answered yet shows nothing.
 * It reads the conversation here, the lowest reader, so a turn ending
 * re-renders the meter and not the chips beside it.
 */
export function BotUsage({ botId }: { botId: string }) {
  const { context, planLimits } = useBotRoomLeft(botId);
  return (
    <ChatUsage
      context={context}
      fiveHour={planLimits?.fiveHour ?? null}
      sevenDay={planLimits?.sevenDay ?? null}
    />
  );
}
