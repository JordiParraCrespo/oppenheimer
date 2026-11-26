import { ChatViewIcons } from '../components/chat-view-icons';
import { useChatReading } from '../hooks/use-session-chat';
import type { PaneReading } from '../lib/chat-blocks';

/**
 * Terminal / Chat in a guest's bar, as in a member's: the two icons, once
 * the transcript has come and the chat is offered. A leaf of its own, so the
 * chat's arrival redraws the switch and not the bar.
 */
export function SharedViewSwitch({ reading }: { reading: PaneReading }) {
  const { offered } = useChatReading(reading);
  if (!offered) return null;
  return (
    <span className="flex items-center gap-2.5 pr-1">
      <ChatViewIcons view={reading.view} onViewChange={reading.onViewChange} />
      <span aria-hidden className="h-4.5 w-px bg-border-subtle" />
    </span>
  );
}
