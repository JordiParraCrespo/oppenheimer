import { useEffect, useState } from 'react';
import { rememberFoldedGroups, storedFoldedGroups, withFold } from '../lib/folded-groups';

/**
 * The project groups folded in the sidebar, and the toggle that changes them.
 * localStorage: a fold outlives the page on this device.
 */
export function useFoldedGroups() {
  const [folded, setFolded] = useState<string[]>(storedFoldedGroups);

  useEffect(() => rememberFoldedGroups(folded), [folded]);

  return {
    folded,
    setOpen: (key: string, open: boolean) => setFolded((current) => withFold(current, key, open)),
  };
}
