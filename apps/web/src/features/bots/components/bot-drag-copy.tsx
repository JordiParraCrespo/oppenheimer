import { BotItem } from '@oppenheimer/design-system-web';
import type { BotEntity } from '@oppenheimer/frontend-consumer';

/**
 * What follows the pointer while a bot is dragged: its photo and name, on
 * the sidebar's ground at the sidebar's width.
 */
export function BotDragCopy({ bot }: { bot: BotEntity }) {
  return (
    <div className="w-60 rounded-md bg-sidebar">
      <BotItem name={bot.name} initials={bot.initials} color={bot.avatarColor} active />
    </div>
  );
}
