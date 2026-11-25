import { useRef } from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent, ScrollView } from 'react-native';
import { atFoot } from '../lib/stick-to-bottom';

/** The props a `ScrollView` takes to stick to its foot. */
export interface StickToBottom {
  ref: React.RefObject<ScrollView | null>;
  onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  onContentSizeChange: () => void;
  scrollEventThrottle: number;
}

/**
 * A list that grows at its foot (a terminal, a chat) and follows it while
 * the reader is there: new content scrolls to the end only if the reader was
 * at the foot when they last scrolled ({@link atFoot}). Once they scroll up
 * to read, new output leaves them where they are; scrolling back down picks
 * the following up again. Spread onto the `ScrollView`. The phone's twin of
 * the web design system's hook of the same name, without the wheel, key and
 * pointer handling a touch screen has no use for.
 */
export function useStickToBottom(): StickToBottom {
  const ref = useRef<ScrollView>(null);
  const following = useRef(true);
  return {
    ref,
    onScroll: (event) => {
      following.current = atFoot(event.nativeEvent);
    },
    onContentSizeChange: () => {
      if (following.current) ref.current?.scrollToEnd({ animated: false });
    },
    scrollEventThrottle: 32,
  };
}
