import {
  Button,
  ChatMarker,
  ChatTranscript,
  TranscriptDivider,
} from '@oppenheimer/design-system-web';
import { Cpu } from '@oppenheimer/design-system-web/icons';
import {
  useBotLive,
  useSendBotMessage,
  useSuspenseBotConversation,
} from '@oppenheimer/frontend-consumer/react';
import { dateFormatter, ErrorAlert, useLocale } from '@oppenheimer/frontend-web';
import { botModelOf } from '@oppenheimer/shared/schemas/bot';
import { Link, useNavigate } from '@tanstack/react-router';
import { Fragment } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { ApprovalEventLine } from '@/features/bots/components/approval-event-line';
import { ApprovedCallLive } from '@/features/bots/components/approved-call-live';
import { BotEventLine } from '@/features/bots/components/bot-event-line';
import { BotTurn } from '@/features/bots/components/bot-turn';
import { useSentGlide } from '@/features/bots/hooks/use-sent-glide';
import { useToolCallsShownInChat } from '@/features/bots/hooks/use-tool-calls-shown';
import { runningApprovedCalls } from '@/features/bots/lib/approval-event';
import {
  chatTurns,
  drawsNothing,
  markersBefore,
  newestSentId,
  newestTurn,
  retryContent,
} from '@/features/bots/lib/chat-turns';
import { BotMessageImages } from '@/features/bots/sections/bot-message-images';
import { BotHello } from './bot-hello';

/**
 * The chat itself (`25-bots.md` §3): every turn as you sent it and as the bot
 * answered, live while one runs, with a marker where the day changes or the
 * next turn runs on another model. Before the first message, the bot's
 * hello. It keeps the bot's stream open while it is on screen, so text
 * arrives as the bot writes it and each stored message the moment it lands.
 * A Needs input card decided while the chat is open, here or elsewhere, is
 * drawn as its decided line at once, until the stored line takes its place;
 * an approved call still running is held under the turn its yes opened.
 * Once the newest turn has ended, Retry sends your last message again.
 * What you send glides to the top of the pane, the answer beneath it.
 */
export function BotTranscript({ botId, name }: { botId: string; name: string }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const { data: conversation, error } = useSuspenseBotConversation(botId);
  const live = useBotLive(botId);
  const retry = useSendBotMessage();
  const navigate = useNavigate();
  const toolCallsShown = useToolCallsShownInChat();
  const blocks = chatTurns(conversation).filter((block) => !drawsNothing(block, toolCallsShown));
  // The approved calls still running, each held under the turn its yes opened.
  const working = new Map(
    [...runningApprovedCalls(conversation.messages)].map(([turnId, call]) => [
      turnId,
      <ApprovedCallLive key={turnId} call={call} />,
    ]),
  );
  const current = conversation.activeTurn?.id;
  const again = retryContent(blocks);
  const newest = newestTurn(blocks)?.turnId;
  useSentGlide(newestSentId(blocks));
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
              <Fragment key={block.key}>
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
                {block.turnId === null ? (
                  block.asked.map((message) => (
                    <BotEventLine
                      key={message.id}
                      message={message}
                      action={
                        <Button
                          variant="ghost"
                          size="xs"
                          render={<Link to="/bots/$botId/settings/routines" params={{ botId }} />}
                        >
                          {t('bots.chat.event.openRoutines')}
                        </Button>
                      }
                    />
                  ))
                ) : (
                  <BotTurn
                    block={block}
                    live={live.text[block.turnId]}
                    current={block.turnId === current}
                    working={working.get(block.turnId)}
                    waitingOn={live.retrying[block.turnId]}
                    subagents={live.subagents}
                    images={(attachments) => (
                      <BotMessageImages botId={botId} attachments={attachments} />
                    )}
                    onRetry={
                      again !== null && block.turnId === newest
                        ? () => retry.mutate({ id: botId, content: again })
                        : undefined
                    }
                    retrying={retry.isPending}
                    onOpenProviders={() => navigate({ to: '/settings/model-providers' })}
                  />
                )}
              </Fragment>
            );
          })}
          {live.resolved.map((event) => (
            <ApprovalEventLine key={event.approvalId} event={event} />
          ))}
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
