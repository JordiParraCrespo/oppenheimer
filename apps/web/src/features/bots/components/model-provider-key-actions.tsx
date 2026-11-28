import { Button } from '@oppenheimer/design-system-web';
import { useTranslation } from 'react-i18next';

/** What one of a provider's several keys offers: Remove it, or Replace it in its place. */
export function ModelProviderKeyActions({
  label,
  hint,
  unavailableReason,
  removing,
  onRemove,
  onReplace,
}: {
  label: string;
  hint: string;
  unavailableReason?: string;
  removing: boolean;
  onRemove: () => void;
  onReplace: () => void;
}) {
  const { t } = useTranslation();
  const unavailable = unavailableReason !== undefined;
  return (
    <>
      <Button
        size="sm"
        variant="ghost"
        aria-label={t('settings.modelProviders.removeKeyLabel', { provider: label, hint })}
        pending={removing}
        disabled={unavailable}
        title={unavailableReason}
        onClick={onRemove}
      >
        {t('settings.modelProviders.remove')}
      </Button>
      <Button
        size="sm"
        variant="secondary"
        aria-label={t('settings.modelProviders.replaceKeyLabel', { provider: label, hint })}
        disabled={unavailable}
        title={unavailableReason}
        onClick={onReplace}
      >
        {t('settings.modelProviders.replace')}
      </Button>
    </>
  );
}
