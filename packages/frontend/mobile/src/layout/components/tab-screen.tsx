import { Text } from '@oppenheimer/design-system-mobile/text';
import type { ReactNode } from 'react';
import { ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TAB_BAR_CLEARANCE } from './tab-bar';

/**
 * The frame of a section's root screen: the large title the export puts at
 * the head of every tab, the content under it, and room at the foot for the
 * floating tab bar to sit over.
 */
export function TabScreen({ title, children }: { title: string; children: ReactNode }) {
  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      <ScrollView
        contentContainerClassName="flex-grow"
        contentContainerStyle={{ paddingBottom: TAB_BAR_CLEARANCE }}
      >
        <Text variant="largeTitle" className="px-5 pt-2">
          {title}
        </Text>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}
