import { Text } from '@oppenheimer/design-system-mobile/text';
import { cn } from '@oppenheimer/design-system-mobile/utils';
import type { TaskSessionState } from '@oppenheimer/frontend-consumer';
import { Platform, View } from 'react-native';
import { SESSION_DOT } from '../lib/session-dot';

const MONO = Platform.select({ ios: 'Menlo', default: 'monospace' });

/** A task's session line, as the console's card draws it: its state, its name, and how many others. */
export function SessionChip({
  state,
  word,
  name,
  others,
}: {
  state: TaskSessionState;
  word: string;
  name: string;
  others: number;
}) {
  return (
    <View className="flex-row items-center gap-1.5 self-start rounded-full bg-secondary px-2.5 py-1">
      <View className={cn('size-1.5 rounded-full', SESSION_DOT[state])} />
      <Text variant="caption" tone="default" className="text-[12px]">
        {word}
      </Text>
      <Text
        variant="caption"
        className="max-w-40 text-[12px]"
        style={{ fontFamily: MONO }}
        numberOfLines={1}
      >
        {name}
      </Text>
      {others > 0 ? (
        <Text variant="caption" className="text-[12px]">
          +{others}
        </Text>
      ) : null}
    </View>
  );
}
