import { DropdownMenuSeparator } from '@oppenheimer/design-system-web';
import type { ReactNode } from 'react';

/**
 * The rows under a `SearchList` in a filter submenu, below a full-width rule:
 * the submenu has no padding of its own, so the foot brings it.
 */
export function SearchListFoot({ children }: { children: ReactNode }) {
  return (
    <>
      <DropdownMenuSeparator className="mx-0" />
      <div className="p-1 pt-0">{children}</div>
    </>
  );
}
