import { Separator } from '@oppenheimer/design-system-mobile/separator';
import { Text } from '@oppenheimer/design-system-mobile/text';
import * as React from 'react';
import { ScrollView, View } from 'react-native';

export default function SeparatorScreen() {
  return (
    <ScrollView contentContainerClassName="p-6 gap-6">
      <View className="gap-2">
        <Text className="text-lg font-semibold text-foreground">Horizontal</Text>
        <View>
          <Text className="text-base font-medium text-foreground">Radix Primitives</Text>
          <Text className="text-sm text-muted-foreground">
            An open-source UI component library.
          </Text>
        </View>
        <Separator />
        <View className="flex-row items-center gap-4 h-5">
          <Text className="text-sm text-foreground">Blog</Text>
          <Separator orientation="vertical" />
          <Text className="text-sm text-foreground">Docs</Text>
          <Separator orientation="vertical" />
          <Text className="text-sm text-foreground">Source</Text>
        </View>
      </View>
    </ScrollView>
  );
}
