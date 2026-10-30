import { BotItem } from '@oppenheimer/design-system-web';
import type { BotEntity } from '@oppenheimer/frontend-consumer';

/**
 * The row a bot drag lifts, in Employees and under a section's Bots heading:
 * the bot's photo and name on the sidebar's ground at its width. Nothing for
 * an id the list no longer has.
 */
export function BotDragOverlay({ bot }: { bot: BotEntity | undefined }) {
  return bot ? (
    <div className="w-60 rounded-md bg-sidebar">
      <BotItem name={bot.name} initials={bot.initials} color={bot.avatarColor} active />
    </div>
  ) : null;
}
