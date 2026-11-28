import { Button } from '@oppenheimer/design-system-web';
import { useTranslation } from 'react-i18next';

/**
 * What one Model providers row offers, decided from the row alone: Make
 * default on a bot provider with a key that new bots do not start on, Remove
 * on one with a key, Add key on a key provider with room for another, and
 * Replace on one with a key. A provider with several keys leaves Remove and
 * Replace to each key's own row, and offers only Add key. A sign-in provider
 * (ChatGPT) says Disconnect, and Connect ChatGPT or Sign in again, instead.
 * `unavailable` is a server that cannot seal keys: the key buttons are off,
 * the reason their title.
 */
export function ModelProviderActions({
  label,
  signIn,
  configured,
  isDefault,
  runsBots = true,
  unavailableReason,
  makingDefault,
  defaultBusy,
  removing,
  keyCount = 0,
  canAddKey = false,
  onMakeDefault,
  onRemove,
  onEdit,
  onAddKey,
}: {
  label: string;
  /** It connects by signing in to a subscription, not with a key. */
  signIn: boolean;
  configured: boolean;
  isDefault: boolean;
  /** A bot can run on it; a voice-only provider (Groq, ElevenLabs) is never the default. */
  runsBots?: boolean;
  unavailableReason?: string;
  /** This row's Make default is in flight. */
  makingDefault: boolean;
  /** Any row's Make default is in flight. */
  defaultBusy: boolean;
  removing: boolean;
  /** How many keys it holds; past one, each key's row offers its own Remove and Replace. */
  keyCount?: number;
  /** A key provider with a key and room for another. */
  canAddKey?: boolean;
  onMakeDefault: () => void;
  onRemove: () => void;
  onEdit: () => void;
  onAddKey?: () => void;
}) {
  const { t } = useTranslation();
  const unavailable = unavailableReason !== undefined;
  const perKey = !signIn && keyCount > 1;

  return (
    <>
      {configured && runsBots && !isDefault ? (
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
      {canAddKey ? (
        <Button
          size="sm"
          variant={perKey ? 'secondary' : 'ghost'}
          aria-label={t('settings.modelProviders.addKeyLabel', { provider: label })}
          disabled={unavailable}
          title={unavailableReason}
          onClick={onAddKey}
        >
          {t('settings.modelProviders.add')}
        </Button>
      ) : null}
      {configured && !perKey ? (
        <Button
          size="sm"
          variant="ghost"
          aria-label={t(
            signIn
              ? 'settings.modelProviders.disconnectLabel'
              : 'settings.modelProviders.removeLabel',
            { provider: label },
          )}
          pending={removing}
          disabled={unavailable}
          title={unavailableReason}
          onClick={onRemove}
        >
          {t(signIn ? 'settings.modelProviders.disconnect' : 'settings.modelProviders.remove')}
        </Button>
      ) : null}
      {perKey ? null : (
        <Button
          size="sm"
          variant="secondary"
          disabled={unavailable}
          title={unavailableReason}
          onClick={onEdit}
        >
          {t(
            signIn
              ? configured
                ? 'settings.modelProviders.reconnect'
                : 'settings.modelProviders.connect'
              : configured
                ? 'settings.modelProviders.replace'
                : 'settings.modelProviders.add',
          )}
        </Button>
      )}
    </>
  );
}
