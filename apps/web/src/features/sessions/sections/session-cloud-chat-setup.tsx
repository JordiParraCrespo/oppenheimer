import {
  Button,
  CodeBlock,
  SegmentedControl,
  SegmentedControlItem,
} from '@oppenheimer/design-system-web';
import { useCreateCloudChatKey } from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert } from '@oppenheimer/frontend-web';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CloudChatAgentPrompt } from '../components/cloud-chat-agent-prompt';
import { CloudChatSteps } from '../components/cloud-chat-steps';
import { cloudChatApiUrl, cloudChatHookUrl } from '../lib/cloud-chat-setup';

/** Who follows the setup: the person, step by step, or a coding agent they hand it to. */
type SetupReader = 'you' | 'agent';

/**
 * How to turn on a Claude Code cloud session's chat
 * (`product/next-steps/cloud-agents.md`, "The chat of a cloud session"): a
 * key for the workspace, then the rest either as steps to follow or as a
 * prompt for a coding agent, the two ways Add host offers its install. Shown
 * on a cloud session that has sent no line yet. The key's secret is in the
 * mutation's result alone, so it is gone once the pane is.
 */
export function SessionCloudChatSetup({ organizationId }: { organizationId: string }) {
  const { t } = useTranslation();
  const createKey = useCreateCloudChatKey();
  // Which way the rest is read; the lowest component that reads it.
  const [reader, setReader] = useState<SetupReader>('you');
  const origin = window.location.origin;
  const apiUrl = cloudChatApiUrl(import.meta.env.VITE_API_URL, origin);
  const hookUrl = cloudChatHookUrl(origin);
  const key = createKey.data;

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
          copyLabel={t('common.copy')}
          copiedLabel={t('common.copied')}
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

      <SegmentedControl
        className="mt-6.5"
        size="md"
        value={reader}
        onValueChange={(next) => setReader(next === 'agent' ? 'agent' : 'you')}
        aria-label={t('sessions.cloudChat.setup.readerLabel')}
      >
        <SegmentedControlItem value="you">
          {t('sessions.cloudChat.setup.readerYou')}
        </SegmentedControlItem>
        <SegmentedControlItem value="agent">
          {t('sessions.cloudChat.setup.readerAgent')}
        </SegmentedControlItem>
      </SegmentedControl>
      {reader === 'agent' ? (
        <CloudChatAgentPrompt hookUrl={hookUrl} apiUrl={apiUrl} />
      ) : (
        <CloudChatSteps hookUrl={hookUrl} apiUrl={apiUrl} cloudKey={key} />
      )}
    </section>
  );
}
