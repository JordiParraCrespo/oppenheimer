import { Text } from '@oppenheimer/design-system-mobile/text';
import type { BotAvatarColor } from '@oppenheimer/shared/schemas/bot';
import { View } from 'react-native';
import { BotAvatar } from './bot-avatar';

/** A bot's face and name in the navigation bar, over the line that says what it does. */
export function BotTitle({
  name,
  initials,
  color,
  line,
}: {
  name: string;
  initials: string;
  color: BotAvatarColor;
  line: string;
}) {
  return (
    <View className="max-w-64 flex-row items-center gap-2.5">
      <BotAvatar initials={initials} color={color} size="sm" />
      <View className="min-w-0 flex-shrink">
        <Text className="text-[17px] font-semibold" numberOfLines={1}>
          {name}
        </Text>
        <Text variant="caption" numberOfLines={1}>
          {line}
        </Text>
      </View>
    </View>
  );
}
