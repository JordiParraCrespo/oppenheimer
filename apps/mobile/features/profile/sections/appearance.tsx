import { Icon } from '@oppenheimer/design-system-mobile/icon';
import { Check, Moon, Sun } from '@oppenheimer/design-system-mobile/icons';
import { Text } from '@oppenheimer/design-system-mobile/text';
import { cn } from '@oppenheimer/design-system-mobile/utils';
import { useColorScheme } from 'nativewind';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

const SCHEMES = [
  { id: 'light', icon: Sun },
  { id: 'dark', icon: Moon },
] as const;

/** Light or dark, as a grouped list with a check on the one in use. */
export function Appearance() {
  const { t } = useTranslation();
  const { colorScheme, setColorScheme } = useColorScheme();

  return (
    <View>
      <View className="px-1 pb-2">
        <Text variant="overline">{t('theme.label')}</Text>
      </View>
      <View className="overflow-hidden rounded-2xl border border-border-subtle bg-card">
        {SCHEMES.map((scheme, index) => {
          const selected = (colorScheme ?? 'light') === scheme.id;
          return (
            <Pressable
              key={scheme.id}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              onPress={() => setColorScheme(scheme.id)}
              className={cn(
                'h-12 flex-row items-center gap-3 px-4 active:bg-accent',
                index > 0 && 'border-t border-border-subtle',
              )}
            >
              <Icon as={scheme.icon} size={17} />
              <View className="flex-1">
                <Text variant="body">{t(`theme.${scheme.id}`)}</Text>
              </View>
              {selected ? <Icon as={Check} size={17} className="text-primary" /> : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
