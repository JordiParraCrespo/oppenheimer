import { useStoredList } from '@oppenheimer/frontend-web';
import {
  movedSection,
  type SidebarSection,
  sectionOrder,
  steppedSection,
} from '../lib/sidebar-sections';

/** The order the reader dragged the sessions sidebar's sections into, kept on this device. */
const SIDEBAR_SECTIONS_KEY = 'oppenheimer.sidebar.sessions-sections';

/** The sessions sidebar's sections in the reader's order, and the move a drop makes. */
export function useSidebarSections() {
  const [stored, setStored] = useStoredList(SIDEBAR_SECTIONS_KEY);
  const order = sectionOrder(stored);
  return {
    order,
    move: (moved: string, target: string) =>
      setStored((current) => movedSection(sectionOrder(current), moved, target)),
    /** Moves `id` one place up (-1) or down (1); past either end it stays. */
    step: (id: SidebarSection, step: -1 | 1) =>
      setStored((current) => steppedSection(sectionOrder(current), id, step)),
  };
}
