import { useStoredList } from '@oppenheimer/frontend-web';

/**
 * Where the reader dragged Ungrouped among the groups of the Employees
 * sidebar, kept on this device as the pins are: the id of the group it is
 * drawn above, or none for last. A place is the reader's, not the
 * workspace's, so the API never hears of it, and a group that is deleted
 * leaves Ungrouped last again.
 */
const UNGROUPED_PLACE_KEY = 'oppenheimer.bots.ungroupedBefore';

type Before = string | undefined;

export function useUngroupedPlace() {
  const [stored, setStored] = useStoredList(UNGROUPED_PLACE_KEY);
  const asList = (groupId: Before) => (groupId ? [groupId] : []);
  return {
    before: stored[0] as Before,
    /** The group Ungrouped is above, or a function of the one it is above now. */
    setBefore: (next: Before | ((current: Before) => Before)) =>
      setStored((current) => asList(typeof next === 'function' ? next(current[0]) : next)),
  };
}

export type UngroupedPlace = ReturnType<typeof useUngroupedPlace>;
