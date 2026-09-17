import { Text } from '@oppenheimer/design-system-mobile/text';
import { View } from 'react-native';

export function AccountRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-center justify-between gap-4">
      <Text className="text-sm text-muted-foreground">{label}</Text>
      <Text className="flex-1 text-right text-sm font-medium text-foreground" numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}
