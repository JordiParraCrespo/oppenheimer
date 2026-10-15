import { Composer, ComposerNotice, ComposerStackAction } from '@oppenheimer/design-system-web';
import { KeyRound } from '@oppenheimer/design-system-web/icons';
import {
  useBotActiveTurn,
  useCancelBotTurn,
  useModelProviders,
  useSendBotMessage,
} from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert } from '@oppenheimer/frontend-web';
import { BOT_PROVIDER_CATALOG, type BotProvider } from '@oppenheimer/shared/schemas/bot';
import { useNavigate } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * The bot's composer. Send says it to the bot; while a turn is queued or
 * running the button is Stop. A provider with no key in the workspace keeps
 * send off and says where to add one, fused to the top of the box. It owns
 * the draft alone: the chips in `tools` and `engine` are elements its parent
 * made, so a keystroke renders the field and none of them.
 */
export function BotComposer({
  botId,
  name,
  provider,
  tools,
  engine,
}: {
  botId: string;
  name: string;
  provider: BotProvider;
  tools: ReactNode;
  engine: ReactNode;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [draft, setDraft] = useState('');
  const active = useBotActiveTurn(botId);
  const { data: keyed } = useModelProviders({
    select: (rows) => rows.find((row) => row.provider === provider)?.configured,
  });
  const send = useSendBotMessage({ onSuccess: () => setDraft('') });
  const cancel = useCancelBotTurn();
  const providerLabel = BOT_PROVIDER_CATALOG[provider].label;
  const noKey = keyed === false ? t('bots.chat.noKey', { provider: providerLabel }) : undefined;
  const failure = send.error ?? cancel.error;

  return (
    <>
      <ErrorAlert
        error={failure}
        fallback={send.error ? t('bots.chat.sendFailed') : t('bots.chat.stopFailed')}
        onDismiss={() => {
          send.reset();
          cancel.reset();
        }}
      />
      <Composer
        value={draft}
        onValueChange={setDraft}
        onSubmit={() => send.mutate({ id: botId, content: draft })}
        onStop={() => active && cancel.mutate({ id: botId, turnId: active.id })}
        busy={active !== null || send.isPending}
        sendBlockedReason={noKey}
        placeholder={t('bots.chat.placeholder', { name })}
        tools={tools}
        engine={engine}
        above={
          noKey ? (
            <ComposerNotice
              icon={<KeyRound />}
              action={
                <ComposerStackAction onClick={() => navigate({ to: '/settings/model-providers' })}>
                  {t('bots.chat.addKey')}
                </ComposerStackAction>
              }
            >
              {noKey}
            </ComposerNotice>
          ) : undefined
        }
        labels={{ send: t('bots.chat.send'), stop: t('bots.chat.stop') }}
      />
    </>
  );
}
