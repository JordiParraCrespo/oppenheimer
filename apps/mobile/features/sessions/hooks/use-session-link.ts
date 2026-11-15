import {
  SessionChat,
  type SessionStream,
  type StreamEnd,
  type StreamStatus,
} from '@oppenheimer/frontend-consumer';
import { useSessionStream } from '@oppenheimer/frontend-consumer/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { TerminalScreen } from '../lib/terminal-screen';

/** Window 0 is the agent's; the phone shows only that one, as the console does. */
const AGENT_WINDOW = 0;

/** A grid the phone starts with before its view has measured itself. */
const FIRST_COLS = 48;
const FIRST_ROWS = 24;

export interface SessionLink {
  chat: SessionChat;
  screen: TerminalScreen;
  status: StreamStatus;
  ended: StreamEnd | null;
  /** Keystrokes for the agent's terminal, as the terminal would encode them. */
  send: (data: string) => void;
  /** The grid the terminal view has room for; only that view asks, so Chat never resizes the host. */
  resize: (cols: number, rows: number) => void;
  retry: () => void;
}

/**
 * The phone's attachment to one session: the stream to its agent's window
 * (the same ticketed WebSocket the console opens), the terminal the bytes
 * draw, and the chat the transcript feeds and that types through the stream.
 * Effect: the session stream, an outside system, held open while mounted.
 */
export function useSessionLink(sessionId: string): SessionLink {
  const open = useSessionStream(sessionId, AGENT_WINDOW);
  const [chat] = useState(() => new SessionChat());
  const [screen] = useState(() => new TerminalScreen(FIRST_COLS, FIRST_ROWS));
  const [status, setStatus] = useState<StreamStatus>('connecting');
  const [ended, setEnded] = useState<StreamEnd | null>(null);
  const stream = useRef<SessionStream | null>(null);

  useEffect(() => {
    const current = open();
    stream.current = current;
    setEnded(null);
    const offData = current.onData((chunk, consumed) => screen.write(chunk, consumed));
    const offStatus = current.onStatus(setStatus);
    const offEnd = current.onEnd(setEnded);
    const offChat = current.onChat?.((batch) => chat.apply(batch));
    const giveBack = chat.connect(
      (data) => current.send(data),
      current.askOlderChat ? (before) => current.askOlderChat?.(before) : undefined,
    );
    return () => {
      giveBack();
      offChat?.();
      offEnd();
      offStatus();
      offData();
      current.dispose();
      chat.detach();
      stream.current = null;
    };
  }, [open, chat, screen]);

  // Effect: the terminal model is an outside object; it is let go with the screen.
  useEffect(() => () => screen.dispose(), [screen]);

  const send = useCallback((data: string) => stream.current?.send(data), []);
  const resize = useCallback(
    (cols: number, rows: number) => {
      screen.resize(cols, rows);
      stream.current?.resize(cols, rows);
    },
    [screen],
  );
  const retry = useCallback(() => stream.current?.reconnectNow(), []);

  return { chat, screen, status, ended, send, resize, retry };
}
