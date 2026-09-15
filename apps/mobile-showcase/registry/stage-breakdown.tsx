import { StageBreakdown } from '@oppenheimer/design-system-mobile/stage-breakdown';
import { Text } from '@oppenheimer/design-system-mobile/text';
import { ScrollView, View } from 'react-native';

const items = [
  { id: 'qualified', label: 'Qualified', value: 9, delta: 50, tone: 'active' as const },
  { id: 'contacted', label: 'Contacted', value: 10, delta: 33.3, tone: 'paused' as const },
  { id: 'new', label: 'New', value: 8, delta: -20, tone: 'draft' as const },
  { id: 'lost', label: 'Lost', value: 3, delta: 0, tone: 'ended' as const },
];

export default function StageBreakdownScreen() {
  return (
    <ScrollView contentContainerClassName="gap-6 p-6">
      <View className="gap-3">
        <View className="flex-row items-baseline justify-between gap-4">
          <Text className="text-sm font-medium text-ink-900">Leads by stage</Text>
          <Text className="text-xs text-ink-400">40 total</Text>
        </View>
        <StageBreakdown
          total={40}
          items={items}
          formatPercentage={(percentage) => `${percentage.toFixed(1)}%`}
        />
      </View>
    </ScrollView>
  );
}
