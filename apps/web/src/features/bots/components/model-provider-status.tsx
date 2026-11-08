import { CheckIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

/**
 * What a connected provider holds, as its row's tag: a green check, then the
 * key's last characters ("Key ending in wzKr"), or for a sign-in provider the
 * account's ("Signed in · a33b").
 */
export function ModelProviderStatus({ signIn, hint }: { signIn: boolean; hint: string }) {
  const { t } = useTranslation();
  return (
    <span className="inline-flex items-center gap-1">
      <CheckIcon className="size-3 text-success" strokeWidth={2.5} aria-hidden />
      {t(signIn ? 'settings.modelProviders.signedIn' : 'settings.modelProviders.keyEnding', {
        hint,
      })}
    </span>
  );
}
