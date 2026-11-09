import { Button, CodeBlock } from '@oppenheimer/design-system-web';
import { Download } from '@oppenheimer/design-system-web/icons';
import { useTranslation } from 'react-i18next';
import {
  CLOUD_CHAT_HOOK_PATH,
  cloudChatEnvironment,
  cloudChatHost,
  cloudChatSettings,
} from '../lib/cloud-chat-setup';

/**
 * The cloud chat's setup for a person to do: the hook and its settings for
 * the repository, then the cloud environment's variables and host. The key
 * fills its variable once it has been created.
 */
export function CloudChatSteps({
  hookUrl,
  apiUrl,
  cloudKey,
}: {
  hookUrl: string;
  apiUrl: string;
  /** The created key; none yet shows a placeholder in its place. */
  cloudKey: string | undefined;
}) {
  const { t } = useTranslation();
  const copy = { copyLabel: t('common.copy'), copiedLabel: t('common.copied') };
  return (
    <>
      <h3 className="mt-6.5 font-semibold text-fg">{t('sessions.cloudChat.setup.hookTitle')}</h3>
      <p className="mt-1 text-sm text-fg-muted">{t('sessions.cloudChat.setup.hookBody')}</p>
      <Button
        className="mt-3"
        variant="secondary"
        render={<a href={hookUrl} download={CLOUD_CHAT_HOOK_PATH.split('/').pop()} />}
      >
        <Download />
        {t('sessions.cloudChat.setup.downloadHook')}
      </Button>
      <CodeBlock
        className="mt-3"
        title={t('sessions.cloudChat.setup.settingsLabel')}
        code={cloudChatSettings()}
        {...copy}
      />

      <h3 className="mt-6.5 font-semibold text-fg">{t('sessions.cloudChat.setup.envTitle')}</h3>
      <p className="mt-1 text-sm text-fg-muted">{t('sessions.cloudChat.setup.envBody')}</p>
      <CodeBlock
        className="mt-3"
        title={t('sessions.cloudChat.setup.envLabel')}
        code={cloudChatEnvironment(
          apiUrl,
          cloudKey ?? t('sessions.cloudChat.setup.keyPlaceholder'),
        )}
        {...copy}
      />
      <CodeBlock
        className="mt-3"
        title={t('sessions.cloudChat.setup.hostLabel')}
        code={cloudChatHost(apiUrl)}
        {...copy}
      />
    </>
  );
}
