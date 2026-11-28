import { Check, TriangleAlert } from '@oppenheimer/design-system-web/icons';
import { useTranslation } from 'react-i18next';

/** One of a provider's keys, on its own row: its last characters, and a warning once it is out of credit. */
export function ModelProviderKeyStatus({ hint, spent }: { hint: string; spent: boolean }) {
  const { t } = useTranslation();
  return (
    <span className="inline-flex items-center gap-1">
      {spent ? (
        <TriangleAlert className="size-3 text-warning" strokeWidth={2.5} aria-hidden />
      ) : (
        <Check className="size-3 text-success" strokeWidth={2.5} aria-hidden />
      )}
      {t(spent ? 'settings.modelProviders.keyEndingSpent' : 'settings.modelProviders.keyEnding', {
        hint,
      })}
    </span>
  );
}
