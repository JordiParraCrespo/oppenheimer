import { ActivityIndicator, Pressable } from 'react-native';
import { Glass } from '../components/ui/glass';
import { Icon } from '../components/ui/icon';
import { Text } from '../components/ui/text';
import type { NativeHeroProps } from './native-hero.types';

/** On iOS, a full-width primary pill in Liquid Glass, floating over the content. */
export function NativeHero({ label, onPress, busy, icon }: NativeHeroProps) {
  return (
    <Glass className="self-stretch rounded-[28px] p-2">
      <Pressable
        onPress={onPress}
        disabled={busy}
        accessibilityRole="button"
        accessibilityState={{ busy, disabled: busy }}
        className="h-12 flex-row items-center justify-center gap-2 rounded-full bg-primary active:opacity-80 disabled:opacity-60"
      >
        {busy ? (
          <ActivityIndicator size="small" />
        ) : (
          <Icon as={icon} size={16} className="text-primary-foreground" />
        )}
        <Text className="text-[17px] font-medium text-primary-foreground">{label}</Text>
      </Pressable>
    </Glass>
  );
}
