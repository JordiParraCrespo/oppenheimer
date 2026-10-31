'use client';

import { useQueries, useQuery, useSuspenseQuery } from '@oppenheimer/frontend-core/react';
import type { BotAttachment } from '@oppenheimer/shared/schemas/bot';
import { type QueryClient, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import type {
  BotApprovalEntity,
  BotConversationEntity,
  BotMessageEntity,
  BotRoomLeft,
  BotTurnEntity,
  BotWaitingMessage,
} from '../modules/bots/bot-conversation.entity';
import {
  BotLiveApprovals,
  type BotResolvedApprovals,
  botResolvedApprovals,
  NO_RESOLVED_APPROVALS,
  noteResolvedApproval,
  withoutClosedApproval,
} from '../modules/bots/live-approvals';
import {
  type BotLiveSubagents,
  type BotSubagentFrames,
  botLiveSubagents,
  forgetEndedBotSubagents,
  NO_BOT_SUBAGENTS,
  putBotSubagents,
} from '../modules/bots/live-subagents';
import {
  appendBotText,
  type BotLiveRetries,
  type BotLiveText,
  type BotTextBuffers,
  botLiveRetries,
  botLiveText,
  clearBotRetry,
  forgetEndedBotTurns,
  NO_BOT_RETRIES,
  NO_BOT_TEXT,
  noteBotRetry,
  putBotSnapshot,
} from '../modules/bots/live-text';
import { botsKeys } from './bots.queries';
import { useConsumerApp } from './context';
import { mutation } from './mutation';

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

export interface ExportBotConversationVariables {
  id: string;
  /** What the file opens with. */
  header: string;
  /** One message as the file says it; an empty string leaves it out. */
  chunk: (message: BotMessageEntity) => string;
  /** The file's media type. */
  type: string;
}

/** The file's pieces: the header, then each message's as it arrives. */
async function piecesOf(
  messages: AsyncIterable<BotMessageEntity>,
  header: string,
  chunk: (message: BotMessageEntity) => string,
): Promise<string[]> {
  const parts = [header];
  for await (const message of messages) {
    const piece = chunk(message);
    if (piece) parts.push(piece);
  }
  return parts;
}

/**
 * Export: the whole chat read once when asked for, each message turned into
 * its piece of the file as it arrives, so the messages are never held
 * together; the pieces become the file. The finished file is still a whole
 * `Blob` in the browser, which is what a download needs.
 */
export const useExportBotConversation = mutation<Blob, ExportBotConversationVariables>({
  run: async (app, { id, header, chunk, type }) =>
    new Blob(await piecesOf(await app.bots.exportConversation(id), header, chunk), { type }),
});

/**
 * Clear history. The chat, its card, the sidebar's last line and the bot's
 * own read are read again, all empty of it now.
 */
export const useClearBotConversation = mutation<void, string>({
  run: (app, id) => app.bots.clearConversation(id),
  update: (queryClient, _data, id) =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: botsKeys.detail(id) }),
      queryClient.invalidateQueries({ queryKey: botsKeys.lists() }),
    ]),
});

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

const NO_WAITING: readonly BotWaitingMessage[] = [];

/**
 * Your messages waiting behind the turn the bot works on, oldest first, for
 * the composer to hold above its field: nothing while the chat loads.
 */
export function useBotWaitingMessages(id: string): readonly BotWaitingMessage[] {
  const app = useConsumerApp();
  const { data } = useQuery<BotConversationEntity, Error, readonly BotWaitingMessage[]>({
    queryKey: botsKeys.conversation(id),
    queryFn: () => app.bots.findConversation(id),
    select: (conversation) => conversation.waitingMessages,
  });
  return data ?? NO_WAITING;
}

const NO_ROOM: BotRoomLeft = { context: null, planLimits: null };

/** How much room the bot has left, as of its newest turn that said; none while the chat loads. */
export function useBotRoomLeft(id: string): BotRoomLeft {
  const app = useConsumerApp();
  const { data } = useQuery<BotConversationEntity, Error, BotRoomLeft>({
    queryKey: botsKeys.conversation(id),
    queryFn: () => app.bots.findConversation(id),
    select: (conversation) => conversation.roomLeft,
  });
  return data ?? NO_ROOM;
}

/**
 * The chat read again, and its goal (a line or a turn may have set, moved or
 * ended it); when a turn has ended, the bot too (its last activity moved) and
 * its Needs input card (the turn may have raised one).
 */
function refetchChat(queryClient: QueryClient, id: string, ended: boolean): Promise<unknown> {
  const reads = [
    queryClient.invalidateQueries({ queryKey: botsKeys.conversation(id) }),
    queryClient.invalidateQueries({ queryKey: botsKeys.goal(id) }),
  ];
  if (ended) {
    reads.push(queryClient.invalidateQueries({ queryKey: botsKeys.lists() }));
    reads.push(queryClient.invalidateQueries({ queryKey: botsKeys.approvals(id) }));
  }
  return Promise.all(reads);
}

export interface SendBotMessageVariables {
  id: string;
  content: string;
  /** Images uploaded for the message (`useUploadBotImage`), in the order attached. */
  attachmentIds?: readonly string[];
}

/** Says something to the bot. The chat is read again for the message and its turn. */
export const useSendBotMessage = mutation<BotTurnEntity, SendBotMessageVariables>({
  run: (app, { id, content, attachmentIds }) => app.bots.sendMessage(id, content, attachmentIds),
  update: (queryClient, _turn, { id }) => refetchChat(queryClient, id, true),
});

export interface UploadBotImageVariables {
  id: string;
  file: Blob;
}

/**
 * Stores an image picked in the composer, before the message is sent, so a
 * refusal (not an image, too large, a model that reads none) is said while
 * the person is still writing. Nothing is read again: nothing on screen
 * holds it until the message is sent.
 */
export const useUploadBotImage = mutation<BotAttachment, UploadBotImageVariables>({
  run: (app, { id, file }) => app.bots.uploadImage(id, file),
});

/** A message's images, as `useBotImages` reads them: each one's bytes once they are in. */
export interface BotImageReads {
  blobs: readonly (Blob | undefined)[];
  /** Which could not be read, by position. */
  failed: readonly boolean[];
}

/** Module-level, so TanStack keeps the combined value while no read changes. */
function combineImages(results: { data: Blob | undefined; isError: boolean }[]): BotImageReads {
  return {
    blobs: results.map((result) => result.data),
    failed: results.map((result) => result.isError),
  };
}

/**
 * The images one message of a bot's chat carried, each its bytes as a
 * `Blob`, in order, for the chat to draw and open. They never change under
 * an id, so they are read once; like everything under `bots`, they are never
 * written to the persisted cache.
 */
export function useBotImages(id: string, attachmentIds: readonly string[]) {
  const app = useConsumerApp();
  return useQueries({
    queries: attachmentIds.map((attachmentId) => ({
      queryKey: botsKeys.image(id, attachmentId),
      queryFn: () => app.bots.readImage(id, attachmentId),
      staleTime: Number.POSITIVE_INFINITY,
      structuralSharing: false,
    })),
    combine: combineImages,
  });
}

export interface CancelBotTurnVariables {
  id: string;
  turnId: string;
}

/** Stop: a queued turn ends now, a running one at its next step. */
export const useCancelBotTurn = mutation<BotTurnEntity, CancelBotTurnVariables>({
  run: (app, { id, turnId }) => app.bots.cancelTurn(id, turnId),
  update: (queryClient, turn, { id }) => refetchChat(queryClient, id, !turn.isActive),
});

export type { BotLiveRetries, BotLiveSubagents, BotLiveText };

/** A bot's chat as it happens, beyond what is stored: by turn, and by `delegate` call. */
export interface BotLive {
  /** The text each running turn is writing, by turn id. */
  text: BotLiveText;
  /** The turns waiting to try a refused call again, and why. */
  retrying: BotLiveRetries;
  /** Where each child of a running `delegate` call is, by the call's id. */
  subagents: BotLiveSubagents;
  /** Cards decided while the chat is open, by any tab or device, whose line is not stored yet. */
  resolved: BotResolvedApprovals;
}

/**
 * The chat, live, while the screen is up: the text each running turn is
 * writing that the stored conversation does not hold yet, which turns wait
 * on a provider that refused a call (until they write again), and where the
 * children of a running `delegate` call are. The stream's text is kept by
 * block ({@link BotTextBuffers}): deltas the turn's text already holds are
 * dropped by `seq`, and the `snapshot` the stream sends as it comes up
 * replaces the block being written, so what was published while it was down
 * is not lost. What is drawn is derived from it and the conversation in
 * render ({@link botLiveText}), so a read landing early or late never draws
 * stored text twice or drops it. A call's children are its
 * newest frame until its stored step ends it ({@link botLiveSubagents}).
 *
 * The conversation is read again the moment a message is stored or a turn
 * moves, and each time the stream comes up (the first connect included) for
 * what the gap may have missed.
 *
 * Needs input cards: one some tab or device decided (`approval_resolved`)
 * leaves the card at once, before the approvals are read again, and its
 * decided line is drawn until the stored one lands ({@link botResolvedApprovals}).
 * One raised while the text is half a line waits for the line to end, or
 * 600 ms ({@link BotApprovalHold}).
 */
export function useBotLive(id: string): BotLive {
  const app = useConsumerApp();
  const queryClient = useQueryClient();
  const { data: conversation } = useSuspenseBotConversation(id);
  const [streamed, setStreamed] = useState<{
    id: string;
    buffers: BotTextBuffers;
    frames: BotSubagentFrames;
  }>({ id, buffers: NO_BOT_TEXT, frames: NO_BOT_SUBAGENTS });
  const [waits, setWaits] = useState<{ id: string; retries: BotLiveRetries }>({
    id,
    retries: NO_BOT_RETRIES,
  });
  const [decided, setDecided] = useState<{ id: string; resolved: BotResolvedApprovals }>({
    id,
    resolved: NO_RESOLVED_APPROVALS,
  });

  // Subscribes to the bot's stream, an outside system, while the chat is open.
  useEffect(() => {
    const stream = app.bots.openStream(id);
    const key = botsKeys.conversation(id);
    const change = (
      next: (state: { buffers: BotTextBuffers; frames: BotSubagentFrames }) => {
        buffers: BotTextBuffers;
        frames: BotSubagentFrames;
      },
    ) =>
      setStreamed((current) => {
        const mine =
          current.id === id ? current : { buffers: NO_BOT_TEXT, frames: NO_BOT_SUBAGENTS };
        const { buffers, frames } = next(mine);
        // Memory only: an ended turn is not drawn whether or not it is dropped here.
        const read = queryClient.getQueryData<BotConversationEntity>(key);
        const kept = {
          buffers: forgetEndedBotTurns(buffers, read),
          frames: forgetEndedBotSubagents(frames, read),
        };
        return current.id === id &&
          kept.buffers === current.buffers &&
          kept.frames === current.frames
          ? current
          : { id, ...kept };
      });
    const retry = (next: (retries: BotLiveRetries) => BotLiveRetries) =>
      setWaits((current) => {
        const retries = next(current.id === id ? current.retries : NO_BOT_RETRIES);
        return current.id === id && retries === current.retries ? current : { id, retries };
      });
    const update = (next: (buffers: BotTextBuffers) => BotTextBuffers) =>
      change((state) => ({ ...state, buffers: next(state.buffers) }));
    // A decided card is retired for good the first time a read holds its line.
    const retireStored = (read: BotConversationEntity | undefined) =>
      setDecided((current) => {
        if (current.id !== id || !read) return current;
        const resolved = botResolvedApprovals(current.resolved, read);
        return resolved === current.resolved ? current : { id, resolved };
      });
    const conversationKey = JSON.stringify(key);
    const offStored = queryClient.getQueryCache().subscribe((cached) => {
      if (cached.type !== 'updated' || JSON.stringify(cached.query.queryKey) !== conversationKey) {
        return;
      }
      retireStored(cached.query.state.data as BotConversationEntity | undefined);
    });
    const approvals = new BotLiveApprovals({
      readCards: () => void queryClient.invalidateQueries({ queryKey: botsKeys.approvals(id) }),
      closeCard: (approvalId) =>
        queryClient.setQueryData<BotApprovalEntity | null>(botsKeys.pendingApproval(id), (card) =>
          withoutClosedApproval(card, approvalId),
        ),
      keepLine: (frame) =>
        setDecided((current) => {
          const noted = noteResolvedApproval(
            current.id === id ? current.resolved : NO_RESOLVED_APPROVALS,
            frame,
          );
          const read = queryClient.getQueryData<BotConversationEntity>(key);
          const resolved = read ? botResolvedApprovals(noted, read) : noted;
          return current.id === id && resolved === current.resolved ? current : { id, resolved };
        }),
    });
    let up = false;

    const offStatus = stream.onStatus((status) => {
      const now = status === 'live';
      if (now && !up) {
        void refetchChat(queryClient, id, false);
        void queryClient.invalidateQueries({ queryKey: botsKeys.approvals(id) });
      }
      up = now;
    });
    const offEvent = stream.onEvent((event) => {
      if (approvals.see(event)) return;
      switch (event.type) {
        case 'retrying':
          retry((retries) => noteBotRetry(retries, event.turnId, event.reason));
          return;
        case 'text':
          retry((retries) => clearBotRetry(retries, event.turnId));
          update((buffers) => appendBotText(buffers, event));
          return;
        case 'snapshot':
          update((buffers) => putBotSnapshot(buffers, event));
          return;
        case 'subagents':
          change((state) => ({ ...state, frames: putBotSubagents(state.frames, event) }));
          return;
        case 'question':
          void queryClient.invalidateQueries({ queryKey: botsKeys.pendingQuestion(id) });
          return;
        case 'message':
        case 'turn': {
          retry((retries) => clearBotRetry(retries, event.turnId));
          const ended =
            event.type === 'turn' && event.status !== 'queued' && event.status !== 'running';
          void refetchChat(queryClient, id, ended);
          return;
        }
      }
    });
    stream.open();
    return () => {
      offStatus();
      offEvent();
      offStored();
      approvals.dispose();
      stream.dispose();
    };
  }, [app, queryClient, id]);

  const mine = streamed.id === id;
  return {
    text: botLiveText(mine ? streamed.buffers : NO_BOT_TEXT, conversation),
    retrying: botLiveRetries(waits.id === id ? waits.retries : NO_BOT_RETRIES, conversation),
    subagents: botLiveSubagents(mine ? streamed.frames : NO_BOT_SUBAGENTS, conversation),
    resolved: botResolvedApprovals(
      decided.id === id ? decided.resolved : NO_RESOLVED_APPROVALS,
      conversation,
    ),
  };
}
