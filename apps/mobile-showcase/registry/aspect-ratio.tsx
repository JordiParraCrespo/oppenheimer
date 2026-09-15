import { AspectRatio } from '@oppenheimer/design-system-mobile/aspect-ratio';
import { Text } from '@oppenheimer/design-system-mobile/text';
import * as React from 'react';
import { ScrollView, View } from 'react-native';

export default function AspectRatioScreen() {
  return (
    <ScrollView contentContainerClassName="p-6 gap-6">
      <View className="gap-2">
        <Text className="text-lg font-semibold text-foreground">16:9</Text>
        <AspectRatio ratio={16 / 9}>
          <View className="flex-1 items-center justify-center rounded-lg bg-muted">
            <Text className="text-muted-foreground">16 : 9</Text>
          </View>
        </AspectRatio>
      </View>

      <View className="gap-2">
        <Text className="text-lg font-semibold text-foreground">4:3</Text>
        <AspectRatio ratio={4 / 3}>
          <View className="flex-1 items-center justify-center rounded-lg bg-muted">
            <Text className="text-muted-foreground">4 : 3</Text>
          </View>
        </AspectRatio>
      </View>

      <View className="gap-2">
        <Text className="text-lg font-semibold text-foreground">1:1</Text>
        <AspectRatio ratio={1}>
          <View className="flex-1 items-center justify-center rounded-lg bg-muted">
            <Text className="text-muted-foreground">1 : 1</Text>
          </View>
        </AspectRatio>
      </View>
    </ScrollView>
  );
}
