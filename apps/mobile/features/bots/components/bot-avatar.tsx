import { Text } from '@oppenheimer/design-system-mobile/text';
import { cn } from '@oppenheimer/design-system-mobile/utils';
import type { BotAvatarColor } from '@oppenheimer/shared/schemas/bot';
import { View } from 'react-native';

const GROUND: Record<BotAvatarColor, string> = {
  mint: 'bg-avatar-mint',
  tangerine: 'bg-avatar-tangerine',
  snow: 'bg-avatar-snow',
  sky: 'bg-avatar-sky',
  lilac: 'bg-avatar-lilac',
  lemon: 'bg-avatar-lemon',
  coral: 'bg-avatar-coral',
  moss: 'bg-avatar-moss',
};

const SIZE = { md: 'size-10', sm: 'size-8' } as const;

/** A bot's face on the phone: its initials, in the dark ink, on its colour. */
export function BotAvatar({
  initials,
  color,
  size = 'md',
}: {
  initials: string;
  color: BotAvatarColor;
  size?: keyof typeof SIZE;
}) {
  return (
    <View className={cn('items-center justify-center rounded-full', SIZE[size], GROUND[color])}>
      <Text
        className={cn(
          'font-semibold text-avatar-ink',
          size === 'sm' ? 'text-[12px]' : 'text-[14px]',
        )}
      >
        {initials}
      </Text>
    </View>
  );
}
