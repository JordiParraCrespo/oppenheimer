import { BrandGlyph, Button } from '@oppenheimer/design-system-web';
import { useTranslation } from 'react-i18next';
import { scaffoldSubmit } from '@/components/auth/scaffold-submit';

/**
 * The social sign-in row at the top of the sign-in and create-account
 * screens. Scaffold: the buttons report which provider was chosen; the OAuth
 * round-trip and the capability read that hides unconfigured providers come
 * back when the API is wired.
 */
export function SocialLoginButtons({
  disabled,
  intent = 'sign-in',
}: {
  disabled?: boolean;
  intent?: 'sign-in' | 'sign-up';
}) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-2.5">
      <Button
        variant="social"
        size="lg"
        block
        type="button"
        disabled={disabled}
        onClick={() => scaffoldSubmit(`${intent}: google`)}
      >
        <BrandGlyph name="google" />
        {t('auth.login.continueWithGoogle')}
      </Button>
      <Button
        variant="social"
        size="lg"
        block
        type="button"
        disabled={disabled}
        onClick={() => scaffoldSubmit(`${intent}: github`)}
      >
        <BrandGlyph name="github" />
        {t('auth.login.continueWithGithub')}
      </Button>
    </div>
  );
}
