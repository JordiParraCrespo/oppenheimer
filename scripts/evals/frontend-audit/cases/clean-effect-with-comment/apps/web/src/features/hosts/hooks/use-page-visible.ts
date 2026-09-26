import { useEffect, useState } from 'react';

/**
 * Whether the tab is in front. The hosts page pauses its heartbeat animation
 * while the tab is hidden, so a background tab costs nothing.
 */
export function usePageVisible(): boolean {
  const [visible, setVisible] = useState(() => document.visibilityState === 'visible');

  // The DOM: `visibilitychange` on the document.
  useEffect(() => {
    const onChange = () => setVisible(document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', onChange);
    return () => document.removeEventListener('visibilitychange', onChange);
  }, []);

  return visible;
}
