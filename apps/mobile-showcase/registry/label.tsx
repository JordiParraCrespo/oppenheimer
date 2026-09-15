import { Checkbox } from '@oppenheimer/design-system-mobile/checkbox';
import { Input } from '@oppenheimer/design-system-mobile/input';
import { Label } from '@oppenheimer/design-system-mobile/label';
import { Text } from '@oppenheimer/design-system-mobile/text';
import * as React from 'react';
import { ScrollView, View } from 'react-native';

export default function LabelScreen() {
  const [checked, setChecked] = React.useState(false);

  return (
    <ScrollView contentContainerClassName="p-6 gap-6">
      <View className="gap-2">
        <Text className="text-lg font-semibold text-foreground">With Input</Text>
        <View className="gap-2">
          <Label nativeID="email-label">Your email address</Label>
          <Input placeholder="Email" aria-labelledby="email-label" />
        </View>
      </View>

      <View className="gap-2">
        <Text className="text-lg font-semibold text-foreground">With Checkbox</Text>
        <View className="flex-row items-center gap-3">
          <Checkbox checked={checked} onCheckedChange={setChecked} />
          <Label nativeID="terms-label" onPress={() => setChecked((v) => !v)}>
            Accept terms and conditions
          </Label>
        </View>
      </View>
    </ScrollView>
  );
}
