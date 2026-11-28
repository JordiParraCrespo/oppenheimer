import { Check, TriangleAlert } from '@oppenheimer/design-system-web/icons';
import { useTranslation } from 'react-i18next';

/**
 * A Model providers row's tag: on a connected provider a green check, then
 * the key's last characters ("Key ending in wzKr"), or for a sign-in provider
 * the account's ("Signed in · a33b"); otherwise "No key", or "Not connected"
 * for a sign-in provider. A provider with several keys says how many ("3
 * keys"), each drawn on a row of its own below. A key out of credit, or a
 * provider whose keys all are, carries a warning instead of the check.
 */
export function ModelProviderStatus({
  signIn,
  hint,
  keys,
}: {
  signIn: boolean;
  hint: string | null;
  /** The provider's stored keys, by whether each is out of credit. */
  keys: readonly { spentAt: Date | null }[];
}) {
  const { t } = useTranslation();
  if (hint === null) {
    return t(signIn ? 'settings.modelProviders.notConnected' : 'settings.modelProviders.noKey');
  }
  const spent = keys.filter((key) => key.spentAt !== null).length;
  const allSpent = keys.length > 0 && spent === keys.length;
  let label = t(signIn ? 'settings.modelProviders.signedIn' : 'settings.modelProviders.keyEnding', {
    hint,
  });
  if (keys.length > 1) {
    label =
      spent > 0
        ? t('settings.modelProviders.keysSpent', { count: keys.length, spent })
        : t('settings.modelProviders.keys', { count: keys.length });
  } else if (allSpent) {
    label = t('settings.modelProviders.keyEndingSpent', { hint });
  }
  return (
    <span className="inline-flex items-center gap-1">
      {allSpent ? (
        <TriangleAlert className="size-3 text-warning" strokeWidth={2.5} aria-hidden />
      ) : (
        <Check className="size-3 text-success" strokeWidth={2.5} aria-hidden />
      )}
      {label}
    </span>
  );
}
