import { BrandMark } from '@oppenheimer/design-system-mobile/brand-mark';
import { Text } from '@oppenheimer/design-system-mobile/text';
import * as React from 'react';
import { ScrollView, View } from 'react-native';

export default function BrandMarkScreen() {
  return (
    <ScrollView contentContainerClassName="p-6 gap-6">
      <View className="gap-3">
        <Text className="text-lg font-semibold text-foreground">Sizes</Text>
        <View className="flex-row items-center gap-4">
          <BrandMark size={16} />
          <BrandMark size={24} />
          <BrandMark size={34} />
          <BrandMark size={48} />
        </View>
      </View>

      <View className="gap-3">
        <Text className="text-lg font-semibold text-foreground">Inks</Text>
        {/* The mark is stroked in `currentColor`, so it takes whatever ink the
            class around it names — the same three the type hierarchy uses. */}
        <View className="flex-row items-center gap-4">
          <BrandMark size={34} />
          <BrandMark size={34} className="text-ink-600" />
          <BrandMark size={34} className="text-ink-400" />
        </View>
      </View>

      <View className="gap-3">
        <Text className="text-lg font-semibold text-foreground">On an inverse surface</Text>
        <View className="flex-row items-center gap-3 rounded-2xl bg-surface-inverse p-6">
          <BrandMark size={28} className="text-on-inverse" />
          <Text className="text-base font-medium text-on-inverse">Oppenheimer</Text>
        </View>
      </View>
    </ScrollView>
  );
}
