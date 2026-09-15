import { Label } from '@oppenheimer/design-system-mobile/label';
import { Text } from '@oppenheimer/design-system-mobile/text';
import { Textarea } from '@oppenheimer/design-system-mobile/textarea';
import * as React from 'react';
import { ScrollView, View } from 'react-native';

export default function TextareaScreen() {
  return (
    <ScrollView contentContainerClassName="p-6 gap-6">
      <View className="gap-2">
        <Text className="text-lg font-semibold text-foreground">Default</Text>
        <Textarea placeholder="Type your message here..." />
      </View>

      <View className="gap-2">
        <Text className="text-lg font-semibold text-foreground">With Label</Text>
        <View className="gap-2">
          <Label nativeID="bio">Bio</Label>
          <Textarea placeholder="Tell us about yourself" aria-labelledby="bio" />
        </View>
      </View>

      <View className="gap-2">
        <Text className="text-lg font-semibold text-foreground">Disabled</Text>
        <Textarea placeholder="Disabled textarea" editable={false} />
      </View>
    </ScrollView>
  );
}
