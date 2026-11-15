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

/**
 * One session, as the export's row draws it: the agent's initial in a disc
 * with the state's dot on its corner, the name, one line of where it runs,
 * what it is asking when it waits on you, and its age.
 */
export function SessionRow({
  name,
  agentInitial,
  dot,
  meta,
  ask,
  age,
  first,
}: {
  name: string;
  agentInitial: string;
  dot: SessionDotTone;
  meta: string;
  ask: string | null;
  age: string;
  /** The first row of its card draws no hairline above it. */
  first: boolean;
}) {
  return (
    <View
      className={cn('min-h-16 flex-row gap-3 px-4 py-3', !first && 'border-t border-border-subtle')}
    >
      <View className="size-8 items-center justify-center rounded-full bg-secondary">
        <Text variant="caption" tone="default">
          {agentInitial}
        </Text>
        <View
          className={cn(
            'absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-card',
            DOT[dot],
          )}
        />
      </View>
      <View className="min-w-0 flex-1 gap-0.5">
        <Text variant="body" numberOfLines={1}>
          {name}
        </Text>
        <Text variant="caption" numberOfLines={1}>
          {meta}
        </Text>
        {ask ? (
          <View className="pt-1">
            <Text variant="body" numberOfLines={2}>
              {ask}
            </Text>
          </View>
        ) : null}
      </View>
      <Text variant="caption">{age}</Text>
    </View>
  );
}
