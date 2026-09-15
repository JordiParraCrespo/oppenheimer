import { Label } from '@oppenheimer/design-system-mobile/label';
import { RadioGroup, RadioGroupItem } from '@oppenheimer/design-system-mobile/radio-group';
import { Text } from '@oppenheimer/design-system-mobile/text';
import * as React from 'react';
import { ScrollView, View } from 'react-native';

export default function RadioGroupScreen() {
  const [value, setValue] = React.useState('comfortable');

  return (
    <ScrollView contentContainerClassName="p-6 gap-6">
      <View className="gap-2">
        <Text className="text-lg font-semibold text-foreground">Basic</Text>
        <RadioGroup value={value} onValueChange={setValue}>
          <View className="flex-row items-center gap-3">
            <RadioGroupItem value="default" aria-labelledby="label-default" />
            <Label nativeID="label-default" onPress={() => setValue('default')}>
              Default
            </Label>
          </View>
          <View className="flex-row items-center gap-3">
            <RadioGroupItem value="comfortable" aria-labelledby="label-comfortable" />
            <Label nativeID="label-comfortable" onPress={() => setValue('comfortable')}>
              Comfortable
            </Label>
          </View>
          <View className="flex-row items-center gap-3">
            <RadioGroupItem value="compact" aria-labelledby="label-compact" />
            <Label nativeID="label-compact" onPress={() => setValue('compact')}>
              Compact
            </Label>
          </View>
        </RadioGroup>
        <Text className="text-sm text-muted-foreground mt-2">Selected: {value}</Text>
      </View>
    </ScrollView>
  );
}
