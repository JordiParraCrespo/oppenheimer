import { Button } from '@oppenheimer/design-system-web';
import { useTranslation } from 'react-i18next';

/**
 * What one Model providers row offers, decided from the row alone: Default on
 * the provider new bots start on, Make default on another with a key, Remove
 * on one with a key, and Add key or Replace on every row. `unavailable` is a
 * server that cannot seal keys: the key buttons are off, the reason their title.
 */
export function ModelProviderActions({
  label,
  configured,
  isDefault,
  unavailableReason,
  makingDefault,
  defaultBusy,
  removing,
  onMakeDefault,
  onRemove,
  onEdit,
}: {
  label: string;
  configured: boolean;
  isDefault: boolean;
  unavailableReason?: string;
  /** This row's Make default is in flight. */
  makingDefault: boolean;
  /** Any row's Make default is in flight. */
  defaultBusy: boolean;
  removing: boolean;
  onMakeDefault: () => void;
  onRemove: () => void;
  onEdit: () => void;
}) {
  const { t } = useTranslation();
  const unavailable = unavailableReason !== undefined;

  return (
    <>
      {isDefault ? t('settings.modelProviders.default') : null}
      {configured && !isDefault ? (
        <Button
          size="sm"
          variant="ghost"
          aria-label={t('settings.modelProviders.makeDefaultLabel', { provider: label })}
          pending={makingDefault}
          disabled={defaultBusy}
          onClick={onMakeDefault}
        >
          {t('settings.modelProviders.makeDefault')}
        </Button>
      ) : null}
      {configured ? (
        <Button
          size="sm"
          variant="ghost"
          aria-label={t('settings.modelProviders.removeLabel', { provider: label })}
          pending={removing}
          disabled={unavailable}
          title={unavailableReason}
          onClick={onRemove}
        >
          {t('settings.modelProviders.remove')}
        </Button>
      ) : null}
      <Button
        size="sm"
        variant="secondary"
        disabled={unavailable}
        title={unavailableReason}
        onClick={onEdit}
      >
        {configured ? t('settings.modelProviders.replace') : t('settings.modelProviders.add')}
      </Button>
    </>
  );
}
