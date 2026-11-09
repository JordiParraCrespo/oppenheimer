import { useStoredList } from '@oppenheimer/frontend-web';
import { createContext, useContext, useMemo } from 'react';
import { BOT_PINS_KEY, placedBotPins, withBotPin } from '../lib/bot-pins';

export type BotPins = {
  pins: readonly string[];
  setPinned: (id: string, pinned: boolean) => void;
  /** The pins a drop on Pinned left, in the order it left them. */
  placePins: (dropped: readonly string[]) => void;
};

/**
 * The Employees sidebar's pins, for the rows' menus: the sidebar decides
 * which section a row is drawn in, and a row reads only whether it is pinned.
 */
export const BotPinsContext = createContext<BotPins>({
  pins: [],
  setPinned: () => {},
  placePins: () => {},
});

/** The bots pinned above the groups, on this device, and the pin that changes them. */
export function useBotPins(): BotPins {
  const [pins, setPins] = useStoredList(BOT_PINS_KEY);

  return useMemo(
    () => ({
      pins,
      setPinned: (id: string, pinned: boolean) =>
        setPins((current) => withBotPin(current, id, pinned)),
      placePins: (dropped: readonly string[]) =>
        setPins((current) => placedBotPins(dropped, current)),
    }),
    [pins, setPins],
  );
}

/** One row's pin: whether it is pinned, and the pin. */
export function useBotPin(id: string) {
  const { pins, setPinned } = useContext(BotPinsContext);
  return {
    pinned: pins.includes(id),
    setPinned: (pinned: boolean) => setPinned(id, pinned),
  };
}
