import { ChatMarker, ChatTranscript, TranscriptDivider } from '@oppenheimer/design-system-web';
import { Cpu } from '@oppenheimer/design-system-web/icons';
import {
  useBotLiveText,
  useSendBotMessage,
  useSuspenseBotConversation,
} from '@oppenheimer/frontend-consumer/react';
import { dateFormatter, ErrorAlert, useLocale } from '@oppenheimer/frontend-web';
import { botModelOf } from '@oppenheimer/shared/schemas/bot';
import { Fragment } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { BotTurn } from '@/features/bots/components/bot-turn';
import { chatTurns, markersBefore, retryContent } from '@/features/bots/lib/chat-turns';
import { BotHello } from './bot-hello';

/**
 * The chat itself (`25-bots.md` §3): every turn as you sent it and as the bot
 * answered, live while one runs, with a marker where the day changes or the
 * next turn runs on another model. Before the first message, the bot's
 * hello. It keeps the bot's stream open while it is on screen, so text
 * arrives as the bot writes it and each stored message the moment it lands.
 * Once the newest turn has ended, Retry sends your last message again.
 */
export function BotTranscript({ botId, name }: { botId: string; name: string }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const { data: conversation, error } = useSuspenseBotConversation(botId);
  const live = useBotLiveText(botId);
  const retry = useSendBotMessage();
  const blocks = chatTurns(conversation);
  const again = retryContent(blocks);
  const newest = blocks.at(-1)?.turnId;
  const day = dateFormatter(locale, { dateStyle: 'medium' });

  return (
    <>
      <ErrorAlert error={error} fallback={t('bots.chat.loadFailed')} className="mb-4" />
      {blocks.length === 0 ? (
        <BotHello botId={botId} name={name} />
      ) : (
        <ChatTranscript>
          {blocks.map((block, index) => {
            const markers = markersBefore(blocks, index);
            return (
              <Fragment key={block.turnId}>
                {markers.day ? (
                  <TranscriptDivider>{day.format(markers.day)}</TranscriptDivider>
                ) : null}
                {markers.model ? (
                  <ChatMarker icon={<Cpu aria-hidden />}>
                    <Trans
                      i18nKey="bots.chat.switchedModel"
                      values={{
                        model:
                          botModelOf(markers.model.provider, markers.model.model)?.label ??
                          markers.model.model,
                      }}
                      components={{ model: <strong /> }}
                    />
                  </ChatMarker>
                ) : null}
                <BotTurn
                  block={block}
                  live={live[block.turnId]}
                  onRetry={
                    again !== null && block.turnId === newest
                      ? () => retry.mutate({ id: botId, content: again })
                      : undefined
                  }
                  retrying={retry.isPending}
                />
              </Fragment>
            );
          })}
          <ErrorAlert
            error={retry.error}
            fallback={t('bots.chat.sendFailed')}
            onDismiss={() => retry.reset()}
          />
        </ChatTranscript>
      )}
    </>
  );
}
