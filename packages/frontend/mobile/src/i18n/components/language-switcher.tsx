import { Select } from '@oppenheimer/design-system-mobile/select';
import { type Locale, locales } from '@oppenheimer/translations/locales';
import { useTranslation } from 'react-i18next';
import { setLocale } from '../lib/i18n';

/** The app's language, chosen from the system's own menu. */
export function LanguageSwitcher() {
  const { t, i18n } = useTranslation();
  const current = (i18n.resolvedLanguage ?? i18n.language) as Locale;

  return (
    <Select
      value={current}
      options={locales.map((locale) => ({ value: locale, label: t(`language.${locale}`) }))}
      onValueChange={(locale) => void setLocale(locale)}
    />
  );
}
