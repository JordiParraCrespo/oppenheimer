import { Text } from '@oppenheimer/design-system-mobile/text';
import type { ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

/**
 * The frame of a section's root screen: the large title the export puts at
 * the head of every tab, with whatever ends its line (the account avatar),
 * and the content under it. The tab bar is the system's, so the scroll view
 * takes its insets from the system too (`contentInsetAdjustmentBehavior`)
 * and content scrolls under the glass.
 */
export function TabScreen({
  title,
  trailing,
  children,
}: {
  title: string;
  /** What sits at the end of the title's line. */
  trailing?: ReactNode;
  children: ReactNode;
}) {
  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerClassName="flex-grow">
        <View className="flex-row items-center justify-between gap-3 px-5 pt-2">
          <Text variant="largeTitle">{title}</Text>
          {trailing}
        </View>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}
