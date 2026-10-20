import { useEffect, useState } from 'react';
import { rememberSessionPins, storedSessionPins, withPin } from '../lib/session-pins';

/**
 * The sessions pinned to the top of the sidebar, and the pin that changes
 * them. localStorage: the pins outlive the page on this device.
 */
export function useSessionPins() {
  const [pins, setPins] = useState<string[]>(storedSessionPins);

  useEffect(() => rememberSessionPins(pins), [pins]);

  return {
    pins,
    setPinned: (id: string, pinned: boolean) => setPins((current) => withPin(current, id, pinned)),
  };
}
