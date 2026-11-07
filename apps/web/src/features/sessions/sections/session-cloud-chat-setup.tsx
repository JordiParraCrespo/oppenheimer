import { Button, CodeBlock } from '@oppenheimer/design-system-web';
import { Download } from '@oppenheimer/design-system-web/icons';
import { useCreateCloudChatKey } from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import {
  CLOUD_CHAT_HOOK_PATH,
  cloudChatApiUrl,
  cloudChatEnvironment,
  cloudChatHookUrl,
  cloudChatHost,
  cloudChatSettings,
} from '../lib/cloud-chat-setup';

/**
 * How to turn on a Claude Code cloud session's chat: a key for the
 * workspace, the hook and its settings for the repository, and the cloud
 * environment's variables and host (`product/next-steps/cloud-agents.md`,
 * "The chat of a cloud session"). Shown on a cloud session that has sent no
 * line yet. The key's secret is in the mutation's result alone, so it is
 * gone once the pane is.
 */
export function SessionCloudChatSetup({ organizationId }: { organizationId: string }) {
  const { t } = useTranslation();
  const createKey = useCreateCloudChatKey();
  const origin = window.location.origin;
  const apiUrl = cloudChatApiUrl(import.meta.env.VITE_API_URL, origin);
  const key = createKey.data;
  const copy = { copyLabel: t('common.copy'), copiedLabel: t('common.copied') };

  return (
    <section className="mt-10 max-w-160 border-border-subtle border-t pt-6.5">
      <h2 className="font-display text-h3 font-semibold text-fg">
        {t('sessions.cloudChat.setup.title')}
      </h2>
      <p className="mt-1.5 text-operate text-fg-muted">{t('sessions.cloudChat.setup.intro')}</p>

      <h3 className="mt-6.5 font-semibold text-fg">{t('sessions.cloudChat.setup.keyTitle')}</h3>
      <p className="mt-1 text-sm text-fg-muted">{t('sessions.cloudChat.setup.keyBody')}</p>
      {createKey.error ? (
        <ErrorAlert
          className="mt-3"
          error={createKey.error}
          fallback={t('sessions.cloudChat.setup.keyFailed')}
        />
      ) : null}
      {key ? (
        <CodeBlock
          className="mt-3"
          title={t('sessions.cloudChat.setup.keyLabel')}
          code={key}
          {...copy}
        />
      ) : (
        <Button
          className="mt-3"
          pending={createKey.isPending}
          pendingLabel={t('sessions.cloudChat.setup.creatingKey')}
          onClick={() => createKey.mutate(organizationId)}
        >
          {t('sessions.cloudChat.setup.createKey')}
        </Button>
      )}

      <h3 className="mt-6.5 font-semibold text-fg">{t('sessions.cloudChat.setup.hookTitle')}</h3>
      <p className="mt-1 text-sm text-fg-muted">{t('sessions.cloudChat.setup.hookBody')}</p>
      <Button
        className="mt-3"
        variant="secondary"
        render={
          <a href={cloudChatHookUrl(origin)} download={CLOUD_CHAT_HOOK_PATH.split('/').pop()} />
        }
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
        code={cloudChatEnvironment(apiUrl, key ?? t('sessions.cloudChat.setup.keyPlaceholder'))}
        {...copy}
      />
      <CodeBlock
        className="mt-3"
        title={t('sessions.cloudChat.setup.hostLabel')}
        code={cloudChatHost(apiUrl)}
        {...copy}
      />
    </section>
  );
}
