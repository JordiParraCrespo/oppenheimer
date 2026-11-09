import type { CloudChatReply, SessionChat } from '@oppenheimer/frontend-consumer';
import { useCloudChatFeed } from '@oppenheimer/frontend-consumer/react';
import { useEffect, useState } from 'react';
import { useSessionChat } from './use-session-chat';

/** Replies listed by id, so a read that changes none of them changes nothing on screen. */
const idsOf = (replies: readonly CloudChatReply[]) => replies.map((reply) => reply.id).join();

/**
 * A Claude Code cloud session's chat, kept current from what its hook sent:
 * the same chat a host session's terminal feeds, the replies the agent has
 * not taken yet, and a reply that did not reach the API.
 */
export function useCloudSessionChat(sessionId: string): {
  chat: SessionChat;
  waiting: readonly CloudChatReply[];
  failure: unknown;
  dismissFailure: () => void;
} {
  // Its own key: the session's pane keeps one under the session's id for a
  // terminal to feed, and a cloud session has none, so that one stays empty
  // and the bar offers no Terminal/Chat switch.
  const chat = useSessionChat(`cloud:${sessionId}`);
  const open = useCloudChatFeed(sessionId);
  const [waiting, setWaiting] = useState<readonly CloudChatReply[]>([]);
  const [failure, setFailure] = useState<unknown>(null);
  // Effect: reads the session's chat from the API on a timer, and lends the
  // chat's composer the way to send a reply, until the pane goes.
  useEffect(() => {
    let stop: (() => void) | null = null;
    let gone = false;
    void open(chat, {
      onWaiting: (next) => setWaiting((now) => (idsOf(now) === idsOf(next) ? now : next)),
      onReplyFailed: setFailure,
    }).then((feed) => {
      if (!gone) stop = feed.start();
    });
    return () => {
      gone = true;
      stop?.();
    };
  }, [open, chat]);
  return { chat, waiting, failure, dismissFailure: () => setFailure(null) };
}
