import { Button } from '@oppenheimer/design-system-mobile/button';
import { Text } from '@oppenheimer/design-system-mobile/text';
import { locales } from '@oppenheimer/translations';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { setLocale } from '../lib/i18n';

export function LanguageSwitcher({ className }: { className?: string }) {
  const { t, i18n } = useTranslation();
  const current = i18n.resolvedLanguage ?? i18n.language;

  return (
    <View className={`flex-row items-center justify-center gap-2 ${className ?? ''}`}>
      {locales.map((locale) => (
        <Button
          key={locale}
          variant={current === locale ? 'default' : 'outline'}
          size="sm"
          onPress={() => setLocale(locale)}
        >
          <Text>{t(`language.${locale}`)}</Text>
        </Button>
      ))}
    </View>
  );
}
