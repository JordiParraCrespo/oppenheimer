import { Text } from '@oppenheimer/design-system-mobile/text';
import type { ReactNode } from 'react';
import { View } from 'react-native';

/** A group of rows under its name and count, on one card: a project, or Needs input. */
export function SessionGroup({
  title,
  count,
  attention,
  children,
}: {
  title: string;
  count: number;
  /** The amber dot before the name, for the group that waits on you. */
  attention?: boolean;
  children: ReactNode;
}) {
  return (
    <View className="gap-2 px-4 pt-3">
      <View className="flex-row items-center gap-2 px-1">
        {attention ? <View className="size-2 rounded-full bg-status-paused" /> : null}
        <Text variant="overline">{title}</Text>
        <Text variant="caption">{String(count)}</Text>
      </View>
      <View className="overflow-hidden rounded-2xl border border-border-subtle bg-card">
        {children}
      </View>
    </View>
  );
}
