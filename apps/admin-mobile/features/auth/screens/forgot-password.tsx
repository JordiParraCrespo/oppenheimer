import { ForgotPasswordScreen as SharedForgotPasswordScreen } from '@oppenheimer/frontend-mobile';
import { useTranslation } from 'react-i18next';

export function ForgotPasswordScreen() {
  const { t } = useTranslation();
  return (
    <SharedForgotPasswordScreen brandLabel={t('common.controlAppName')} loginHref="/(auth)/login" />
  );
}
