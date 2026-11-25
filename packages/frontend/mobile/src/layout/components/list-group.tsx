import { Text } from '@oppenheimer/design-system-mobile/text';
import type { ReactNode } from 'react';
import { View } from 'react-native';

/**
 * A group of rows on one card, under its name and count, as the export's
 * lists draw them (a project's sessions, Needs input, a team of employees).
 * With no `title` the card stands alone; a `count` not known yet is left out
 * rather than drawn as a zero.
 */
export function ListGroup({
  title,
  count,
  attention,
  children,
}: {
  title: string | null;
  count: number | null;
  /** The amber dot before the name, for the group that waits on you. */
  attention?: boolean;
  children: ReactNode;
}) {
  return (
    <View className="gap-2 px-4 pt-3">
      {title ? (
        <View className="flex-row items-center gap-2 px-1">
          {attention ? <View className="size-2 rounded-full bg-status-paused" /> : null}
          <Text variant="overline">{title}</Text>
          {count !== null ? <Text variant="caption">{String(count)}</Text> : null}
        </View>
      ) : null}
      <View className="overflow-hidden rounded-2xl border border-border-subtle bg-card">
        {children}
      </View>
    </View>
  );
}
