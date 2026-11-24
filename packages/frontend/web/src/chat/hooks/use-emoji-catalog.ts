import { useEffect, useState } from 'react';
import { type EmojiGroup, loadEmojiCatalog } from '../lib/emoji-catalog';

/**
 * The emoji catalog, grouped; null until its chunk has loaded. The effect
 * waits on the lazily imported module (`loadEmojiCatalog`), which is read
 * once and shared by every picker.
 */
export function useEmojiCatalog(): readonly EmojiGroup[] | null {
  const [groups, setGroups] = useState<readonly EmojiGroup[] | null>(null);
  useEffect(() => {
    let current = true;
    void loadEmojiCatalog().then((loaded) => {
      if (current) setGroups(loaded);
    });
    return () => {
      current = false;
    };
  }, []);
  return groups;
}
