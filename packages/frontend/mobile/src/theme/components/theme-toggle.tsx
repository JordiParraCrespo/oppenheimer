import { Icon } from '@oppenheimer/design-system-mobile/icon';
import { Moon, Sun } from '@oppenheimer/design-system-mobile/icons';
import { cn } from '@oppenheimer/design-system-mobile/utils';
import { useColorScheme } from 'nativewind';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

/**
 * The brand's two-up theme pill, as the web kit draws it: a hairline capsule
 * whose active half fills with a light grey knob. The knob colour is
 * deliberately the same in both themes — it is the one piece of chrome that
 * does not invert.
 *
 * It is 36px tall rather than web's 30: this one is tapped, not clicked.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { t } = useTranslation();
  const { colorScheme, toggleColorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  const half = 'flex-1 flex-row items-center justify-center rounded-full';
  const knob = 'bg-theme-toggle-knob';

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: isDark }}
      accessibilityLabel={t('theme.toggle')}
      onPress={toggleColorScheme}
      className={cn(
        'h-9 w-[72px] flex-row rounded-full border border-border-default p-1',
        className,
      )}
    >
      <View className={cn(half, !isDark && knob)}>
        <Icon
          as={Sun}
          size={15}
          className={isDark ? 'text-theme-toggle-icon-idle' : 'text-theme-toggle-icon'}
        />
      </View>
      <View className={cn(half, isDark && knob)}>
        <Icon
          as={Moon}
          size={15}
          className={isDark ? 'text-theme-toggle-icon' : 'text-theme-toggle-icon-idle'}
        />
      </View>
    </Pressable>
  );
}
