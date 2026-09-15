import { Text } from '@oppenheimer/design-system-mobile/text';
import { Toggle } from '@oppenheimer/design-system-mobile/toggle';
import * as React from 'react';
import { ScrollView, View } from 'react-native';

export default function ToggleScreen() {
  return (
    <ScrollView contentContainerClassName="p-6 gap-6">
      <View className="gap-2">
        <Text className="text-lg font-semibold text-foreground">Default</Text>
        <View className="flex-row gap-3">
          <DemoToggle>
            <Text>B</Text>
          </DemoToggle>
          <DemoToggle>
            <Text>I</Text>
          </DemoToggle>
          <DemoToggle>
            <Text>U</Text>
          </DemoToggle>
        </View>
      </View>

      <View className="gap-2">
        <Text className="text-lg font-semibold text-foreground">Outline</Text>
        <View className="flex-row gap-3">
          <DemoToggle variant="outline">
            <Text>B</Text>
          </DemoToggle>
          <DemoToggle variant="outline">
            <Text>I</Text>
          </DemoToggle>
          <DemoToggle variant="outline">
            <Text>U</Text>
          </DemoToggle>
        </View>
      </View>

      <View className="gap-2">
        <Text className="text-lg font-semibold text-foreground">Sizes</Text>
        <View className="flex-row gap-3 items-center">
          <DemoToggle size="sm">
            <Text>sm</Text>
          </DemoToggle>
          <DemoToggle size="default">
            <Text>md</Text>
          </DemoToggle>
          <DemoToggle size="lg">
            <Text>lg</Text>
          </DemoToggle>
        </View>
      </View>

      <View className="gap-2">
        <Text className="text-lg font-semibold text-foreground">Disabled</Text>
        <DemoToggle disabled>
          <Text>Disabled</Text>
        </DemoToggle>
      </View>
    </ScrollView>
  );
}

function DemoToggle(props: Omit<React.ComponentProps<typeof Toggle>, 'pressed' | 'onPressedChange'>) {
  const [pressed, setPressed] = React.useState(false);
  return <Toggle {...props} pressed={pressed} onPressedChange={setPressed} />;
}
