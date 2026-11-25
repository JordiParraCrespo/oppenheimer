import * as React from 'react';
import type { useSortableControl } from '../components/drag';

type SortableControl = ReturnType<typeof useSortableControl>;

/**
 * What a `SortableSidebarSection` hands the `SidebarListHead` and the
 * `SidebarFoldLabel` inside it: the pointer and keys that pick the section
 * up with the pointer, for the head, and the fold label as the control,
 * which lifts it from the keyboard. `null` outside one,
 * where the head and the label are what they always were.
 */
export const SidebarSectionHandle = React.createContext<{
  handle: Pick<SortableControl['node'], 'onPointerDown'>;
  control: SortableControl['control'];
} | null>(null);
