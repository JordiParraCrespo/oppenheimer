import { Text } from '@oppenheimer/design-system-mobile/text';
import { cn } from '@oppenheimer/design-system-mobile/utils';
import { View } from 'react-native';
import type { SessionDotTone } from '../lib/session-filters';

const DOT: Record<SessionDotTone, string> = {
  waiting: 'bg-status-paused',
  running: 'bg-status-active',
  failed: 'bg-destructive',
  idle: 'bg-ink-400',
};

/** The session's name in the navigation bar, over its state's dot and line. */
export function SessionTitle({
  name,
  dot,
  line,
}: {
  name: string;
  dot: SessionDotTone;
  line: string;
}) {
  return (
    <View className="max-w-64">
      <Text className="text-[17px] font-semibold" numberOfLines={1}>
        {name}
      </Text>
      <View className="flex-row items-center gap-1.5">
        <View className={cn('size-2 rounded-full', DOT[dot])} />
        <Text variant="caption" numberOfLines={1}>
          {line}
        </Text>
      </View>
    </View>
  );
}
