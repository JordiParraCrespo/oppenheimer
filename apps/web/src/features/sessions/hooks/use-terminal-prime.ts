import { CONSUMER_CONFIG } from '@oppenheimer/frontend-consumer/config';
import { usePrimeSessionStream } from '@oppenheimer/frontend-consumer/react';
import { useEffect, useRef } from 'react';
import { AGENT_WINDOW, isTerminalWarm, terminalKey } from '../lib/terminal-pool';

/**
 * Handlers for a link that opens a session: a pointer or focus resting on it
 * mints the terminal's attach ticket, so the dial the click starts skips that
 * round trip (`SessionsService.primeAttachTicket`). Passing over a row on the
 * way somewhere else mints nothing, and neither does a session whose terminal
 * the pool already keeps, which needs no dial at all. `enabled` is false for a
 * session with no terminal to attach to yet.
 */
export function useTerminalPrime(sessionId: string, enabled: boolean) {
  const prime = usePrimeSessionStream();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancel = () => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
  };
  const start = () => {
    const key = terminalKey(sessionId, AGENT_WINDOW);
    if (!enabled || timer.current !== null || isTerminalWarm(key)) return;
    timer.current = setTimeout(() => {
      timer.current = null;
      if (!isTerminalWarm(key)) prime(sessionId, AGENT_WINDOW);
    }, CONSUMER_CONFIG.stream.primeDelayMs);
  };

  // The rest timer: a row that unmounts under the pointer mints nothing.
  useEffect(
    () => () => {
      if (timer.current !== null) clearTimeout(timer.current);
    },
    [],
  );

  return { onPointerEnter: start, onPointerLeave: cancel, onFocus: start, onBlur: cancel };
}
