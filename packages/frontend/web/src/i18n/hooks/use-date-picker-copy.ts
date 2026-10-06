import { useTranslation } from 'react-i18next';
import { useLocale } from './use-locale';

/**
 * What the design system's `DatePicker` needs to read in the reader's
 * language: the locale its month is named in, the trigger's words with no
 * day, and the popover's controls. Spread it on the picker.
 */
export function useDatePickerCopy() {
  const { t } = useTranslation();
  const locale = useLocale();
  return {
    locale,
    placeholder: t('common.dateField.none'),
    labels: {
      choose: t('common.dateField.choose'),
      previous: t('common.dateField.previousMonth'),
      next: t('common.dateField.nextMonth'),
      clear: t('common.dateField.clear'),
    },
  };
}
