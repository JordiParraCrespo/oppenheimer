import { ChatViewToggle } from '../components/chat-view-toggle';
import { useChatReading } from '../hooks/use-session-chat';
import type { PaneReading } from '../lib/chat-blocks';

/**
 * What a session's status line carries in the side pane: the Terminal / Chat
 * switch once the session has a chat, and nothing else. The echo readout and
 * Share are the session's own page's, one click away through its tab's link;
 * at the pane's width they crowded the switch to a cut-off word.
 */
export function SideSessionStatus({ reading }: { reading: PaneReading }) {
  const { offered } = useChatReading(reading);
  if (!offered) return null;
  return <ChatViewToggle view={reading.view} onViewChange={reading.onViewChange} />;
}
