import { Skeleton } from '@oppenheimer/design-system-mobile/skeleton';
import { Text } from '@oppenheimer/design-system-mobile/text';
import * as React from 'react';
import { ScrollView, View } from 'react-native';

export default function SkeletonScreen() {
  return (
    <ScrollView contentContainerClassName="p-6 gap-6">
      <View className="gap-2">
        <Text className="text-lg font-semibold text-foreground">Card</Text>
        <View className="flex-row items-center gap-4">
          <Skeleton style={{ height: 48, width: 48, borderRadius: 24 }} />
          <View className="gap-2 flex-1">
            <Skeleton style={{ height: 16, width: '75%' }} />
            <Skeleton style={{ height: 16, width: '50%' }} />
          </View>
        </View>
      </View>

      <View className="gap-2">
        <Text className="text-lg font-semibold text-foreground">Content Block</Text>
        <View className="gap-3">
          <Skeleton style={{ height: 16, width: '100%' }} />
          <Skeleton style={{ height: 16, width: '100%' }} />
          <Skeleton style={{ height: 16, width: '75%' }} />
        </View>
      </View>

      <View className="gap-2">
        <Text className="text-lg font-semibold text-foreground">Image</Text>
        <Skeleton style={{ height: 192, width: '100%', borderRadius: 10 }} />
      </View>
    </ScrollView>
  );
}
