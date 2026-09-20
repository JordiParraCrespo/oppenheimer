import { useEffect, useState } from 'react';

const TOKEN_LIFETIME = 60 * 60;
/** How long the scaffold waits before pretending the runner registered. */
const REGISTER_AFTER_MS = 6000;

export type PairedHost = { name: string; meta: string };

/**
 * The pairing token's clock and the host it eventually pairs. Both effects
 * synchronise with timers: the one-second tick that counts the token down,
 * and the delay that stands in for a runner registering.
 *
 * Scaffold: nothing here reaches the API. The token is a fixed string, the
 * host that "registers" is a fixture, and `regenerate` only resets the clock.
 */
export function usePairingToken() {
  const [seconds, setSeconds] = useState(TOKEN_LIFETIME - 19);
  const [host, setHost] = useState<PairedHost | null>(null);
  const [generation, setGeneration] = useState(0);

  useEffect(() => {
    const tick = setInterval(() => setSeconds((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(tick);
  }, []);

  useEffect(() => {
    const timer = setTimeout(
      () => setHost({ name: 'mac-studio', meta: 'macOS 15 · echo 38 ms' }),
      REGISTER_AFTER_MS,
    );
    return () => clearTimeout(timer);
  }, []);

  const minutes = Math.floor(seconds / 60);
  const countdown = `${minutes}:${String(seconds % 60).padStart(2, '0')}`;

  return {
    token: `opk_7f3a9c${generation ? generation : ''}`,
    countdown,
    host,
    regenerate: () => {
      setSeconds(TOKEN_LIFETIME);
      setGeneration((g) => g + 1);
    },
  };
}
