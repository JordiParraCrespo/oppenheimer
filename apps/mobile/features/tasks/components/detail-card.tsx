import { Text } from '@oppenheimer/design-system-mobile/text';
import type { ReactNode } from 'react';
import { View } from 'react-native';

/** One part of a task's page: its overline, then its card. */
export function DetailCard({ title, children }: { title: string | null; children: ReactNode }) {
  return (
    <View className="gap-2 px-4 pt-4">
      {title ? (
        <Text variant="overline" className="px-1">
          {title}
        </Text>
      ) : null}
      <View className="overflow-hidden rounded-2xl border border-border-subtle bg-card">
        {children}
      </View>
    </View>
  );
}
