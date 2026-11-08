import { CodeBlock } from '@oppenheimer/design-system-web';
import { useTranslation } from 'react-i18next';
import { cloudChatAgentPrompt } from '../lib/cloud-chat-setup';

/**
 * The cloud chat's setup as one prompt for a coding agent in a checkout of
 * the repository (`cloudChatAgentPrompt`): it adds the hook and its
 * settings, and hands back what only the person can set on claude.ai.
 */
export function CloudChatAgentPrompt({ hookUrl, apiUrl }: { hookUrl: string; apiUrl: string }) {
  const { t } = useTranslation();
  return (
    <>
      <h3 className="mt-6.5 font-semibold text-fg">{t('sessions.cloudChat.setup.agentTitle')}</h3>
      <p className="mt-1 text-sm text-fg-muted">{t('sessions.cloudChat.setup.agentBody')}</p>
      <CodeBlock
        className="mt-3"
        title={t('sessions.cloudChat.setup.agentLabel')}
        code={cloudChatAgentPrompt(hookUrl, apiUrl)}
        copyLabel={t('common.copy')}
        copiedLabel={t('common.copied')}
      />
    </>
  );
}
