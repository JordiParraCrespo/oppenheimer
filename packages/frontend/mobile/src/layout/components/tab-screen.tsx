import { Text } from '@oppenheimer/design-system-mobile/text';
import type { ReactNode } from 'react';
import { ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

/**
 * The frame of a section's root screen: the large title the export puts at
 * the head of every tab, and the content under it. The tab bar is the
 * system's, so the scroll view takes its insets from the system too
 * (`contentInsetAdjustmentBehavior`) and content scrolls under the glass.
 */
export function TabScreen({ title, children }: { title: string; children: ReactNode }) {
  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerClassName="flex-grow">
        <Text variant="largeTitle" className="px-5 pt-2">
          {title}
        </Text>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}
