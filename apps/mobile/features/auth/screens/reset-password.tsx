import { ResetPasswordScreen as SharedResetPasswordScreen } from '@oppenheimer/frontend-mobile';

export function ResetPasswordScreen() {
  return (
    <SharedResetPasswordScreen
      forgotPasswordHref="/(auth)/forgot-password"
      loginHref="/(auth)/login"
    />
  );
}
