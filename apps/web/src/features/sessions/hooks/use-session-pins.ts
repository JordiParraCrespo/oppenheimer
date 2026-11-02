import { createContext, useContext, useMemo } from 'react';
import { SESSION_PINS_KEY, withPin } from '../lib/session-pins';
import { mergeOrder } from '../lib/sidebar-order';
import { useStoredList } from './use-stored-list';

export type SessionPins = {
  pins: readonly string[];
  setPinned: (id: string, pinned: boolean) => void;
  /**
   * The pins a drop on Pinned left, in the order it left them; a pin the
   * drop did not see (filtered out) keeps its place.
   */
  placePins: (dropped: readonly string[]) => void;
};

/**
 * The sidebar's pins, for the rows' menus: the sidebar decides which group a
 * row is drawn in, and a row reads only whether it is pinned, so no group in
 * between carries the pin. The value changes only when a pin does.
 */
export const SessionPinsContext = createContext<SessionPins>({
  pins: [],
  setPinned: () => {},
  placePins: () => {},
});

/**
 * The sessions pinned to the top of the sidebar, and the pin that changes
 * them. localStorage: the pins outlive the page on this device.
 */
export function useSessionPins(): SessionPins {
  const [pins, setPins] = useStoredList(SESSION_PINS_KEY);

  // One identity per set of pins, so a sidebar render redraws no row through the context.
  return useMemo(
    () => ({
      pins,
      setPinned: (id: string, pinned: boolean) =>
        setPins((current) => withPin(current, id, pinned)),
      placePins: (dropped: readonly string[]) => setPins((current) => mergeOrder(dropped, current)),
    }),
    [pins, setPins],
  );
}

/** One row's end: whether it is pinned, and the pin. */
export function useSessionPin(id: string) {
  const { pins, setPinned } = useContext(SessionPinsContext);
  return {
    pinned: pins.includes(id),
    setPinned: (pinned: boolean) => setPinned(id, pinned),
  };
}
