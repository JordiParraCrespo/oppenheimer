import { Text } from '@oppenheimer/design-system-mobile/text';
import { cn } from '@oppenheimer/design-system-mobile/utils';
import type { BottomTabBarProps } from 'expo-router/tabs';
import { useColorScheme } from 'nativewind';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { THEME } from '../../theme';

/** How far a screen's content keeps clear of the floating bar, above the safe area. */
export const TAB_BAR_CLEARANCE = 96;

/**
 * The app's sections as the export draws them: a floating pill over the
 * content, one capsule per section, the current one filled. Each screen gives
 * its icon (`tabBarIcon`) and short label (`tabBarLabel`, else `title`) in its
 * `Tabs.Screen` options; this only lays them out.
 *
 * The export's pill is frosted glass. React Native has no backdrop blur
 * without a native module, so it is the popover surface at full strength.
 */
export function TabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { colorScheme } = useColorScheme();
  const palette = THEME[colorScheme === 'dark' ? 'dark' : 'light'];

  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={t('nav.sections')}
      style={{ bottom: Math.max(insets.bottom, 12) }}
      className="absolute left-3 right-3 flex-row gap-0.5 rounded-full border border-border-subtle bg-popover p-[5px] shadow-lg"
    >
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const focused = state.index === index;
        const color = focused ? palette.foreground : palette.mutedForeground;
        const label =
          typeof options.tabBarLabel === 'string'
            ? options.tabBarLabel
            : (options.title ?? route.name);

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
        };

        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={options.title ?? label}
            onPress={onPress}
            className={cn(
              'h-[54px] min-w-0 flex-1 items-center justify-center gap-0.5 rounded-full px-0.5',
              focused && 'bg-surface-sunken',
            )}
          >
            <View className="h-[26px] items-center justify-center">
              {options.tabBarIcon?.({ focused, color, size: 22 })}
            </View>
            <Text numberOfLines={1} tone={focused ? 'default' : 'muted'} className="text-[11px]">
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
