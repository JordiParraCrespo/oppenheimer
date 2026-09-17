import { Icon } from '@oppenheimer/design-system-mobile/icon';
import { Text } from '@oppenheimer/design-system-mobile/text';
import { Asterisk, Moon, Sun } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

export function AuthHeader() {
  const { t } = useTranslation();
  const { colorScheme, toggleColorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <View className="flex-row items-center justify-between">
      <View className="flex-row items-center gap-3">
        <Icon as={Asterisk} size={34} strokeWidth={2.5} className="text-foreground" />
        <Text className="text-xl font-medium text-foreground">Oppenheimer Control</Text>
      </View>
      <Pressable
        onPress={toggleColorScheme}
        accessibilityRole="switch"
        accessibilityState={{ checked: isDark }}
        accessibilityLabel={t('theme.toggle')}
        className="h-9 w-[72px] flex-row rounded-full border border-border bg-card p-1"
      >
        <View
          className={
            isDark
              ? 'flex-1 items-center justify-center'
              : 'flex-1 items-center justify-center rounded-full bg-muted'
          }
        >
          <Icon as={Sun} size={17} className="text-muted-foreground" />
        </View>
        <View
          className={
            isDark
              ? 'flex-1 items-center justify-center rounded-full bg-muted'
              : 'flex-1 items-center justify-center'
          }
        >
          <Icon as={Moon} size={17} className="text-muted-foreground" />
        </View>
      </Pressable>
    </View>
  );
}
