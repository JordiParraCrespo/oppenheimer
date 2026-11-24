import * as React from 'react';
import type { useSortableControl } from '../components/drag';

type SortableControl = ReturnType<typeof useSortableControl>;

/**
 * What a `SortableSidebarSection` hands the `SidebarListHead` and the
 * `SidebarFoldLabel` inside it: the pointer and keys that pick the section
 * up, for the head, and the fold label as the control. `null` outside one,
 * where the head and the label are what they always were.
 */
export const SidebarSectionHandle = React.createContext<{
  handle: Pick<SortableControl['node'], 'onPointerDown' | 'onKeyDown'>;
  control: SortableControl['control'];
} | null>(null);
