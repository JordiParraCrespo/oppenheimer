import { ListedBotTab } from './listed-bot-tab';
import { ShownBotTab } from './shown-bot-tab';

/**
 * A bot open as a tab over Sessions, by its id: the one on screen from the
 * bot itself, the others from the bots list.
 */
export function BotOpenTab({
  botId,
  active,
  onClose,
}: {
  botId: string;
  active: boolean;
  onClose: () => void;
}) {
  return active ? (
    <ShownBotTab botId={botId} onClose={onClose} />
  ) : (
    <ListedBotTab botId={botId} onClose={onClose} />
  );
}
