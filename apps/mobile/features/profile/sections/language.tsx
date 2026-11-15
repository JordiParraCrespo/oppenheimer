import { Icon } from '@oppenheimer/design-system-mobile/icon';
import { Globe } from '@oppenheimer/design-system-mobile/icons';
import { Text } from '@oppenheimer/design-system-mobile/text';
import { LanguageSwitcher } from '@oppenheimer/frontend-mobile';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

/** The app's language, beside Appearance. */
export function Language() {
  const { t } = useTranslation();

  return (
    <View>
      <View className="px-1 pb-2">
        <Text variant="overline">{t('language.label')}</Text>
      </View>
      <View className="h-12 flex-row items-center gap-3 rounded-2xl border border-border-subtle bg-card px-4">
        <Icon as={Globe} size={17} />
        <View className="flex-1">
          <Text variant="body">{t('language.label')}</Text>
        </View>
        <LanguageSwitcher />
      </View>
    </View>
  );
}
