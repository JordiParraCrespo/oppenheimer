import { Input } from '@oppenheimer/design-system-mobile/input';
import { Label } from '@oppenheimer/design-system-mobile/label';
import { Text } from '@oppenheimer/design-system-mobile/text';
import * as React from 'react';
import { ScrollView, View } from 'react-native';

export default function InputScreen() {
  return (
    <ScrollView contentContainerClassName="p-6 gap-6">
      <View className="gap-2">
        <Text className="text-lg font-semibold text-foreground">Default</Text>
        <Input placeholder="Email" />
      </View>

      <View className="gap-2">
        <Text className="text-lg font-semibold text-foreground">With Label</Text>
        <View className="gap-2">
          <Label nativeID="email">Email</Label>
          <Input placeholder="m@example.com" aria-labelledby="email" />
        </View>
      </View>

      <View className="gap-2">
        <Text className="text-lg font-semibold text-foreground">Disabled</Text>
        <Input placeholder="Disabled input" editable={false} />
      </View>

      <View className="gap-2">
        <Text className="text-lg font-semibold text-foreground">Password</Text>
        <Input placeholder="Password" secureTextEntry />
      </View>
    </ScrollView>
  );
}
