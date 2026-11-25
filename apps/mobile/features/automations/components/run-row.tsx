import { Text } from '@oppenheimer/design-system-mobile/text';
import { cn } from '@oppenheimer/design-system-mobile/utils';
import type { AutomationRunTone } from '@oppenheimer/frontend-consumer';
import { View } from 'react-native';
import { RUN_DOT } from '../lib/run-dot';

/** One of an automation's recent runs: its state under a dot, what started it, and when. */
export function RunRow({
  state,
  tone,
  title,
  age,
  first,
}: {
  state: string;
  tone: AutomationRunTone;
  title: string;
  age: string;
  first: boolean;
}) {
  return (
    <View className={cn('flex-row gap-3 px-4 py-3', !first && 'border-t border-border-subtle')}>
      <View className="min-w-0 flex-1 gap-0.5">
        <View className="flex-row items-center gap-2">
          <View className={cn('size-2 rounded-full', RUN_DOT[tone])} />
          <Text variant="body">{state}</Text>
        </View>
        <Text variant="caption" numberOfLines={1}>
          {title}
        </Text>
      </View>
      <Text variant="caption">{age}</Text>
    </View>
  );
}
