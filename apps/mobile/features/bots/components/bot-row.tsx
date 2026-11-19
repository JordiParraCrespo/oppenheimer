import { Text } from '@oppenheimer/design-system-mobile/text';
import { cn } from '@oppenheimer/design-system-mobile/utils';
import type { BotAvatarColor } from '@oppenheimer/shared/schemas/bot';
import { View } from 'react-native';
import { BotAvatar } from './bot-avatar';

/**
 * One employee, as the export's row draws it: its face, its name, its last
 * line (its description before the first), and how long ago it last spoke.
 */
export function BotRow({
  name,
  initials,
  color,
  line,
  age,
  first,
}: {
  name: string;
  initials: string;
  color: BotAvatarColor;
  line: string;
  age: string;
  /** The first row of its card draws no hairline above it. */
  first: boolean;
}) {
  return (
    <View
      className={cn('min-h-16 flex-row gap-3 px-4 py-3', !first && 'border-t border-border-subtle')}
    >
      <BotAvatar initials={initials} color={color} />
      <View className="min-w-0 flex-1 gap-0.5">
        <Text variant="body" className="font-medium" numberOfLines={1}>
          {name}
        </Text>
        <Text variant="caption" numberOfLines={2}>
          {line}
        </Text>
      </View>
      <Text variant="caption">{age}</Text>
    </View>
  );
}
