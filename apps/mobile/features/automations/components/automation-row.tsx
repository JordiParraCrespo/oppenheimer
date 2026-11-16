import { Icon } from '@oppenheimer/design-system-mobile/icon';
import { Clock, Github } from '@oppenheimer/design-system-mobile/icons';
import { Text } from '@oppenheimer/design-system-mobile/text';
import { cn } from '@oppenheimer/design-system-mobile/utils';
import type { ReactNode } from 'react';
import { View } from 'react-native';
import type { RunTone } from '../lib/automation-words';

const DOT: Record<RunTone | 'paused', string> = {
  running: 'bg-status-active',
  completed: 'bg-status-active',
  failed: 'bg-destructive',
  paused: 'bg-ink-400',
};

/**
 * One automation, as the export's row draws it: its trigger's glyph (GitHub
 * or a clock), its name, the trigger in words, its last run's state and age
 * under a dot, and the switch that pauses it (`trailing`). A paused row is
 * drawn quieter.
 */
export function AutomationRow({
  name,
  github,
  trigger,
  status,
  tone,
  paused,
  first,
  trailing,
}: {
  name: string;
  github: boolean;
  trigger: string;
  status: string;
  tone: RunTone | 'paused';
  paused: boolean;
  first: boolean;
  trailing: ReactNode;
}) {
  return (
    <View
      className={cn(
        'min-h-16 flex-row items-center gap-3 px-4 py-3',
        !first && 'border-t border-border-subtle',
      )}
    >
      <View
        className={cn(
          'size-8 items-center justify-center rounded-full bg-secondary',
          paused && 'opacity-50',
        )}
      >
        <Icon as={github ? Github : Clock} size={16} className="text-foreground" />
      </View>
      <View className={cn('min-w-0 flex-1 gap-0.5', paused && 'opacity-50')}>
        <Text variant="body" numberOfLines={1}>
          {name}
        </Text>
        <Text variant="caption" numberOfLines={1}>
          {trigger}
        </Text>
        <View className="flex-row items-center gap-1.5">
          <View className={cn('size-1.5 rounded-full', DOT[tone])} />
          <Text variant="caption" className="text-[12px]" numberOfLines={1}>
            {status}
          </Text>
        </View>
      </View>
      {trailing}
    </View>
  );
}
