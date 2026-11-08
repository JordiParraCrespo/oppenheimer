import { Check } from '@oppenheimer/design-system-web/icons';
import { useTranslation } from 'react-i18next';

/**
 * A Model providers row's tag: on a connected provider a green check, then
 * the key's last characters ("Key ending in wzKr"), or for a sign-in provider
 * the account's ("Signed in · a33b"); otherwise "No key", or "Not connected"
 * for a sign-in provider.
 */
export function ModelProviderStatus({ signIn, hint }: { signIn: boolean; hint: string | null }) {
  const { t } = useTranslation();
  if (hint === null) {
    return t(signIn ? 'settings.modelProviders.notConnected' : 'settings.modelProviders.noKey');
  }
  return (
    <span className="inline-flex items-center gap-1">
      <Check className="size-3 text-success" strokeWidth={2.5} aria-hidden />
      {t(signIn ? 'settings.modelProviders.signedIn' : 'settings.modelProviders.keyEnding', {
        hint,
      })}
    </span>
  );
}
