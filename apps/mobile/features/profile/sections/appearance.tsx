import { Icon } from '@oppenheimer/design-system-mobile/icon';
import { Moon, Sun } from '@oppenheimer/design-system-mobile/icons';
import { Select } from '@oppenheimer/design-system-mobile/select';
import { Text } from '@oppenheimer/design-system-mobile/text';
import { useColorScheme } from 'nativewind';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

/** Light or dark, chosen from the system's own menu. */
export function Appearance() {
  const { t } = useTranslation();
  const { colorScheme, setColorScheme } = useColorScheme();
  const current = colorScheme === 'dark' ? 'dark' : 'light';

  return (
    <View>
      <View className="px-1 pb-2">
        <Text variant="overline">{t('theme.label')}</Text>
      </View>
      <View className="h-12 flex-row items-center gap-3 rounded-2xl border border-border-subtle bg-card px-4">
        <Icon as={current === 'dark' ? Moon : Sun} size={17} />
        <View className="flex-1">
          <Text variant="body">{t('theme.label')}</Text>
        </View>
        <Select
          value={current}
          options={[
            { value: 'light', label: t('theme.light') },
            { value: 'dark', label: t('theme.dark') },
          ]}
          onValueChange={setColorScheme}
        />
      </View>
    </View>
  );
}
