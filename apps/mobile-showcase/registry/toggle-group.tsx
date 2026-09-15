import { Text } from '@oppenheimer/design-system-mobile/text';
import { ToggleGroup, ToggleGroupItem } from '@oppenheimer/design-system-mobile/toggle-group';
import * as React from 'react';
import { ScrollView, View } from 'react-native';

export default function ToggleGroupScreen() {
  const [single, setSingle] = React.useState('center');
  const [multi, setMulti] = React.useState<string[]>(['bold']);

  return (
    <ScrollView contentContainerClassName="p-6 gap-6">
      <View className="gap-2">
        <Text className="text-lg font-semibold text-foreground">Single Selection</Text>
        <ToggleGroup
          type="single"
          value={single}
          onValueChange={(v) => v && setSingle(v)}
          variant="outline"
        >
          <ToggleGroupItem value="left" isFirst>
            <Text>Left</Text>
          </ToggleGroupItem>
          <ToggleGroupItem value="center">
            <Text>Center</Text>
          </ToggleGroupItem>
          <ToggleGroupItem value="right" isLast>
            <Text>Right</Text>
          </ToggleGroupItem>
        </ToggleGroup>
        <Text className="text-sm text-muted-foreground">Selected: {single}</Text>
      </View>

      <View className="gap-2">
        <Text className="text-lg font-semibold text-foreground">Multiple Selection</Text>
        <ToggleGroup type="multiple" value={multi} onValueChange={setMulti}>
          <ToggleGroupItem value="bold" isFirst>
            <Text>B</Text>
          </ToggleGroupItem>
          <ToggleGroupItem value="italic">
            <Text>I</Text>
          </ToggleGroupItem>
          <ToggleGroupItem value="underline" isLast>
            <Text>U</Text>
          </ToggleGroupItem>
        </ToggleGroup>
        <Text className="text-sm text-muted-foreground">
          Selected: {multi.join(', ') || 'none'}
        </Text>
      </View>
    </ScrollView>
  );
}
