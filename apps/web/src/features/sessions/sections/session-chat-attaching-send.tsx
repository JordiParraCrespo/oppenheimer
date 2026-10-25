import type { SessionChat as Chat } from '@oppenheimer/frontend-consumer';
import { usePasteSessionFile } from '@oppenheimer/frontend-consumer/react';
import type { ChatAttach } from '../lib/chat-blocks';
import { SessionChatSend } from './session-chat-send';

/** Window 0 is the agent's (05): the chat is that window's. */
const AGENT_WINDOW = 0;

/**
 * The chat's send for a reader who may put files on the session's host (a
 * member on their own session): the upload is the terminal's, a file written
 * to the host with its path pasted into the agent's prompt (05).
 */
export function SessionChatAttachingSend({
  chat,
  attach,
  onSent,
}: {
  chat: Chat;
  attach: ChatAttach;
  onSent: () => void;
}) {
  const paste = usePasteSessionFile(attach.sessionId, AGENT_WINDOW);
  return (
    <SessionChatSend
      chat={chat}
      files={attach.files}
      upload={(file) => paste.mutateAsync(file)}
      onSent={onSent}
    />
  );
}
