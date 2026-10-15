'use client';

import { useQuery, useSuspenseQuery, withCacheOnSuccess } from '@oppenheimer/frontend-core/react';
import {
  type QueryClient,
  type UseMutationOptions,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import type { BotConversationEntity, BotTurnEntity } from '../modules/bots/bot-conversation.entity';
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

/** The chat read again; when a turn has ended, the bot too (its last activity moved). */
function refetchChat(queryClient: QueryClient, id: string, ended: boolean): Promise<unknown> {
  const reads = [queryClient.invalidateQueries({ queryKey: botsKeys.conversation(id) })];
  if (ended) reads.push(queryClient.invalidateQueries({ queryKey: botsKeys.lists() }));
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

/** What a turn has written that is not in the stored conversation yet, by turn id. */
export type BotLiveText = Readonly<Record<string, string>>;

const NONE: BotLiveText = {};

/**
 * The chat, live, while the screen is up: the text each running turn is
 * writing, and the conversation read again the moment a message is stored or
 * a turn moves. Each time the stream comes up (the first connect included),
 * the conversation is read once for what the gap may have missed.
 *
 * A turn's text arrives as pieces. A stored message takes the pieces before
 * it, so once the conversation that holds it is read, they leave the live
 * text: what remains is only what is still being written.
 */
export function useBotLiveText(id: string): BotLiveText {
  const app = useConsumerApp();
  const queryClient = useQueryClient();
  const [live, setLive] = useState<{ id: string; text: BotLiveText }>({ id, text: NONE });

  // Subscribes to the bot's stream, an outside system, while the chat is open.
  useEffect(() => {
    const stream = app.bots.openStream(id);
    /** Every piece each turn has streamed, and how much of it is stored. */
    const written = new Map<string, { text: string; stored: number }>();
    const publish = () => {
      const text: Record<string, string> = {};
      for (const [turnId, turn] of written) {
        const rest = turn.text.slice(turn.stored);
        if (rest) text[turnId] = rest;
      }
      setLive({ id, text });
    };
    let up = false;

    const offStatus = stream.onStatus((status) => {
      const now = status === 'live';
      if (now && !up) {
        written.clear();
        publish();
        void refetchChat(queryClient, id, false);
      }
      up = now;
    });
    const offEvent = stream.onEvent((event) => {
      const turn = written.get(event.turnId) ?? { text: '', stored: 0 };
      written.set(event.turnId, turn);
      if (event.type === 'text') {
        turn.text += event.text;
        publish();
        return;
      }
      const upTo = turn.text.length;
      const ended =
        event.type === 'turn' && event.status !== 'queued' && event.status !== 'running';
      void refetchChat(queryClient, id, ended).then(() => {
        turn.stored = Math.max(turn.stored, upTo);
        if (ended) written.delete(event.turnId);
        publish();
      });
    });
    return () => {
      offStatus();
      offEvent();
      stream.dispose();
    };
  }, [app, queryClient, id]);

  return live.id === id ? live.text : NONE;
}
