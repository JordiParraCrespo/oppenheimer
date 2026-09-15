import { Checkbox } from '@oppenheimer/design-system-mobile/checkbox';
import { Label } from '@oppenheimer/design-system-mobile/label';
import { Text } from '@oppenheimer/design-system-mobile/text';
import * as React from 'react';
import { ScrollView, View } from 'react-native';

export default function CheckboxScreen() {
  const [checked1, setChecked1] = React.useState(false);
  const [checked2, setChecked2] = React.useState(true);
  const [checked3, setChecked3] = React.useState(false);

  return (
    <ScrollView contentContainerClassName="p-6 gap-6">
      <View className="gap-2">
        <Text className="text-lg font-semibold text-foreground">Basic</Text>
        <View className="gap-4">
          <View className="flex-row items-center gap-3">
            <Checkbox checked={checked1} onCheckedChange={setChecked1} />
            <Label nativeID="terms" onPress={() => setChecked1((v) => !v)}>
              Accept terms and conditions
            </Label>
          </View>
          <View className="flex-row items-center gap-3">
            <Checkbox checked={checked2} onCheckedChange={setChecked2} />
            <Label nativeID="newsletter" onPress={() => setChecked2((v) => !v)}>
              Subscribe to newsletter
            </Label>
          </View>
          <View className="flex-row items-center gap-3">
            <Checkbox checked={checked3} onCheckedChange={setChecked3} />
            <Label nativeID="notifications" onPress={() => setChecked3((v) => !v)}>
              Enable notifications
            </Label>
          </View>
        </View>
      </View>

      <View className="gap-2">
        <Text className="text-lg font-semibold text-foreground">Disabled</Text>
        <View className="flex-row items-center gap-3">
          <Checkbox checked={false} onCheckedChange={() => {}} disabled />
          <Text className="text-sm text-muted-foreground">Disabled checkbox</Text>
        </View>
      </View>
    </ScrollView>
  );
}
