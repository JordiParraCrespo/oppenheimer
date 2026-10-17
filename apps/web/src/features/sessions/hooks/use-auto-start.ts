import { useNavigate } from '@tanstack/react-router';
import { useEffect, useRef } from 'react';

/**
 * Start the session as soon as the draft can be sent, once, when the address
 * asks for it (`?start=1`, Settings' **Open terminal**). The `start` is taken
 * off the address first, so going back to New session does not open a second
 * terminal.
 */
export function useAutoStart(requested: boolean, ready: boolean, start: () => void) {
  const navigate = useNavigate();
  const started = useRef(false);

  // The address is the outside system: its `start` is spent the moment it acts.
  useEffect(() => {
    if (!requested || !ready || started.current) return;
    started.current = true;
    navigate({
      to: '/sessions/new',
      search: (previous) => ({ ...previous, start: undefined }),
      replace: true,
    });
    start();
  }, [requested, ready, start, navigate]);
}
