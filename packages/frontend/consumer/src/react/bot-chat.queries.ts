'use client';

import { useQuery, useSuspenseQuery, withCacheOnSuccess } from '@oppenheimer/frontend-core/react';
import {
  type QueryClient,
  type UseMutationOptions,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import type {
  BotConversationEntity,
  BotMessageEntity,
  BotTurnEntity,
} from '../modules/bots/bot-conversation.entity';
import {
  appendBotText,
  type BotLiveText,
  type BotTextBuffers,
  botLiveText,
  forgetEndedBotTurns,
  markBotStreamGap,
  NO_BOT_TEXT,
} from '../modules/bots/live-text';
import { botsKeys } from './bots.queries';
import { useConsumerApp } from './context';

/**
 * A bot's chat (`product/versions/mvp/25-bots.md` §3): the stored
 * conversation, sending, Stop, and the text a running turn is writing.
 */

/** The newest messages, oldest first, and their turns, under a Suspense `QueryState`. */
export function useSuspenseBotConversation(id: string) {
  const app = useConsumerApp();
  return useSuspenseQuery<BotConversationEntity, Error>({
    queryKey: botsKeys.conversation(id),
    queryFn: () => app.bots.findConversation(id),
  });
}

/** What Settings says of a chat: how many messages it holds, the newest's time, whether a turn works. */
export interface BotHistory {
  messageCount: number;
  lastMessageAt: Date | null;
  /** A turn is queued or running: Clear history is refused until it ends. */
  busy: boolean;
}

/** The chat read as Settings → Profile's history row draws it, under a Suspense `QueryState`. */
export function useSuspenseBotHistory(id: string) {
  const app = useConsumerApp();
  return useSuspenseQuery<BotConversationEntity, Error, BotHistory>({
    queryKey: botsKeys.conversation(id),
    queryFn: () => app.bots.findConversation(id),
    select: (conversation) => ({
      messageCount: conversation.messageCount,
      lastMessageAt: conversation.lastMessageAt,
      busy: conversation.activeTurn !== null,
    }),
  });
}

/** Export: the whole chat, oldest first, read once when asked for. */
export function useExportBotConversation(
  options?: UseMutationOptions<BotMessageEntity[], Error, string>,
) {
  const app = useConsumerApp();
  return useMutation({
    mutationFn: (id: string) => app.bots.exportConversation(id),
    ...options,
  });
}

/**
 * Clear history. The chat, its card, the sidebar's last line and the bot's
 * own read are read again, all empty of it now.
 */
export function useClearBotConversation(options?: UseMutationOptions<void, Error, string>) {
  const app = useConsumerApp();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => app.bots.clearConversation(id),
    ...withCacheOnSuccess(options, (_data, id) =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: botsKeys.detail(id) }),
        queryClient.invalidateQueries({ queryKey: botsKeys.lists() }),
      ]),
    ),
  });
}

/**
 * The turn Stop applies to, for a reader that draws nothing while the chat
 * loads (the composer): `null` when nothing is queued or running.
 */
export function useBotActiveTurn(id: string): BotTurnEntity | null {
  const app = useConsumerApp();
  const { data } = useQuery<BotConversationEntity, Error, BotTurnEntity | null>({
    queryKey: botsKeys.conversation(id),
    queryFn: () => app.bots.findConversation(id),
    select: (conversation) => conversation.activeTurn,
  });
  return data ?? null;
}

/**
 * The chat read again; when a turn has ended, the bot too (its last activity
 * moved) and its Needs input card (the turn may have raised one).
 */
function refetchChat(queryClient: QueryClient, id: string, ended: boolean): Promise<unknown> {
  const reads = [queryClient.invalidateQueries({ queryKey: botsKeys.conversation(id) })];
  if (ended) {
    reads.push(queryClient.invalidateQueries({ queryKey: botsKeys.lists() }));
    reads.push(queryClient.invalidateQueries({ queryKey: botsKeys.approvals(id) }));
  }
  return Promise.all(reads);
}

export interface SendBotMessageVariables {
  id: string;
  content: string;
}

/** Says something to the bot. The chat is read again for the message and its turn. */
export function useSendBotMessage(
  options?: UseMutationOptions<BotTurnEntity, Error, SendBotMessageVariables>,
) {
  const app = useConsumerApp();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, content }: SendBotMessageVariables) => app.bots.sendMessage(id, content),
    ...withCacheOnSuccess(options, (_turn, { id }) => refetchChat(queryClient, id, true)),
  });
}

export interface CancelBotTurnVariables {
  id: string;
  turnId: string;
}

/** Stop: a queued turn ends now, a running one at its next step. */
export function useCancelBotTurn(
  options?: UseMutationOptions<BotTurnEntity, Error, CancelBotTurnVariables>,
) {
  const app = useConsumerApp();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, turnId }: CancelBotTurnVariables) => app.bots.cancelTurn(id, turnId),
    ...withCacheOnSuccess(options, (turn, { id }) => refetchChat(queryClient, id, !turn.isActive)),
  });
}

export type { BotLiveText };

/**
 * The chat, live, while the screen is up: the text each running turn is
 * writing that the stored conversation does not hold yet. The stream's text
 * is kept as it arrived ({@link BotTextBuffers}); what is drawn is derived
 * from it and the conversation in render ({@link botLiveText}), so a read
 * landing early or late never draws stored text twice or drops it.
 *
 * The conversation is read again the moment a message is stored or a turn
 * moves, and each time the stream comes up (the first connect included) for
 * what the gap may have missed.
 */
export function useBotLiveText(id: string): BotLiveText {
  const app = useConsumerApp();
  const queryClient = useQueryClient();
  const { data: conversation } = useSuspenseBotConversation(id);
  const [streamed, setStreamed] = useState<{ id: string; buffers: BotTextBuffers }>({
    id,
    buffers: NO_BOT_TEXT,
  });

  // Subscribes to the bot's stream, an outside system, while the chat is open.
  useEffect(() => {
    const stream = app.bots.openStream(id);
    const key = botsKeys.conversation(id);
    const update = (next: (buffers: BotTextBuffers) => BotTextBuffers) =>
      setStreamed((current) => {
        const buffers = next(current.id === id ? current.buffers : NO_BOT_TEXT);
        // Memory only: an ended turn is not drawn whether or not it is dropped here.
        const kept = forgetEndedBotTurns(
          buffers,
          queryClient.getQueryData<BotConversationEntity>(key),
        );
        return current.id === id && kept === current.buffers ? current : { id, buffers: kept };
      });
    let up = false;

    const offStatus = stream.onStatus((status) => {
      const now = status === 'live';
      if (now && !up) {
        update(markBotStreamGap);
        void refetchChat(queryClient, id, false);
        void queryClient.invalidateQueries({ queryKey: botsKeys.approvals(id) });
      }
      up = now;
    });
    const offEvent = stream.onEvent((event) => {
      if (event.type === 'text') {
        update((buffers) => appendBotText(buffers, event.turnId, event.text));
        return;
      }
      if (event.type === 'approval') {
        void queryClient.invalidateQueries({ queryKey: botsKeys.approvals(id) });
        return;
      }
      const ended =
        event.type === 'turn' && event.status !== 'queued' && event.status !== 'running';
      void refetchChat(queryClient, id, ended);
    });
    stream.open();
    return () => {
      offStatus();
      offEvent();
      stream.dispose();
    };
  }, [app, queryClient, id]);

  return botLiveText(streamed.id === id ? streamed.buffers : NO_BOT_TEXT, conversation);
}
