import { useEffect, useState } from 'react';

/** How long the card says "Sent" before it gives way to the record in the chat. */
const SENT_FLASH_MS = 1400;

/**
 * The title of a form just sent, held for a moment so the card can say so
 * before it goes; null once the moment has passed. The effect owns a timer.
 */
export function useSentFlash() {
  const [sent, setSent] = useState<string | null>(null);
  useEffect(() => {
    if (sent === null) return;
    const timer = setTimeout(() => setSent(null), SENT_FLASH_MS);
    return () => clearTimeout(timer);
  }, [sent]);
  return { sent, flash: setSent };
}
