import { consumerModules } from '@oppenheimer/frontend-consumer';
import { OppenheimerApp } from '@oppenheimer/frontend-core';
import { OppenheimerProvider } from '@oppenheimer/frontend-core/react';
import { QueryState } from '@oppenheimer/frontend-web';
import { BOT_STREAM_EVENT, BOT_STREAM_READY } from '@oppenheimer/shared/schemas/bot';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, waitFor } from '@testing-library/react';
import { expect, vi } from 'vitest';
import { BotChatScroller } from '../../components/bot-chat-scroller';
import { BotTranscript } from '../../sections/bot-transcript';

/**
 * A bot's chat as it was recorded on the wire, the way Codex's TUI replays a
 * session's protocol events into its chat widget: what the API answered to
 * `GET /api/v1/bots/:id/conversation`, and what `GET /api/v1/bots/:id/stream`
 * sent, in the order it happened. Replayed through the real data path:
 * `fetch` answers the reads, an `EventSource` sends the frames, and the
 * product package's repository, stream and `useBotLive` turn them into what
 * `BotTranscript` draws, so a fixture stays the wire's bytes and never an
 * entity the spec built.
 */
export interface BotRecording {
  botId: string;
  frames: readonly BotFrame[];
}

export type BotFrame =
  /** The conversation `GET …/conversation` answers from here on (its response DTO, as JSON). */
  | { type: 'read'; conversation: unknown }
  /** The stream's `ready` frame: it is live, and the chat reads the conversation again. */
  | { type: 'ready' }
  /** A `bot` frame's data, as the API sent it; one this build cannot read is dropped by the stream. */
  | { type: 'bot'; event: unknown }
  /** A point the spec plays to, then looks. */
  | { type: 'mark'; name: string };

/** Where a stretch of the recording ends: before the stream's first frame, at a mark, or at its end. */
type Stop = { at: 'stream' } | { at: 'mark'; name: string } | { at: 'end' };

const API = 'http://api.test';

/** An `EventSource` the replay drives; the stream opens one per chat on screen. */
class ReplayedSource {
  readyState = 1;
  onerror: ((event: Event) => void) | null = null;
  private readonly listeners = new Map<string, ((event: MessageEvent<string>) => void)[]>();

  constructor(readonly url: string) {}

  addEventListener(type: string, listener: (event: MessageEvent<string>) => void) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }

  close() {
    this.readyState = 2;
  }

  send(type: string, data: string) {
    for (const listener of this.listeners.get(type) ?? []) {
      listener(new MessageEvent(type, { data }));
    }
  }
}

/** No account behind it: the bot's reads carry no headers, and nothing signs in. */
const signedOut = {
  signIn: () => Promise.reject(new Error('replay')),
  signUp: () => Promise.reject(new Error('replay')),
  signInSocial: () => Promise.reject(new Error('replay')),
  signOut: () => Promise.resolve(),
  forgotPassword: () => Promise.reject(new Error('replay')),
  resetPassword: () => Promise.reject(new Error('replay')),
  getSession: () => Promise.resolve(null),
  getAuthHeaders: () => Promise.resolve({}),
};

const memory = () => {
  const items = new Map<string, string>();
  return {
    get: async (key: string) => items.get(key) ?? null,
    set: async (key: string, value: string) => void items.set(key, value),
    remove: async (key: string) => void items.delete(key),
    clear: async () => items.clear(),
  };
};

/**
 * Renders the chat over `recording`: the frames up to the first stream frame
 * are what the API held when the chat opened, and the rest play on asking
 * (`playTo`, `playAll`). `reads` counts the conversation reads the chat made,
 * the first included. Asks for anything else fail the replay, so a renderer
 * that starts reading something new says so here.
 */
export async function replayBotChat(recording: BotRecording) {
  const conversationUrl = `${API}/api/v1/bots/${recording.botId}/conversation`;
  let answer: unknown;
  let cursor = 0;
  let reads = 0;
  const strays: string[] = [];
  const sources: ReplayedSource[] = [];

  vi.stubGlobal(
    'EventSource',
    class extends ReplayedSource {
      constructor(url: string) {
        super(url);
        sources.push(this);
      }
    },
  );
  vi.stubGlobal('fetch', async (input: Request | string) => {
    const url = typeof input === 'string' ? input : input.url;
    if (url !== conversationUrl) {
      strays.push(url);
      return new Response(null, { status: 404 });
    }
    reads += 1;
    return Response.json(answer);
  });

  /** The frames from the cursor up to `stop`, which stays unread. */
  const take = (stop: Stop) => {
    const taken: BotFrame[] = [];
    for (; cursor < recording.frames.length; cursor += 1) {
      const frame = recording.frames[cursor] as BotFrame;
      switch (frame.type) {
        case 'read':
          break;
        case 'ready':
        case 'bot':
          if (stop.at === 'stream') return taken;
          break;
        case 'mark':
          if (stop.at === 'stream' || (stop.at === 'mark' && frame.name === stop.name)) {
            return taken;
          }
          break;
      }
      taken.push(frame);
    }
    return taken;
  };

  // What the API held when the chat opened: its reads, before the stream says anything.
  for (const frame of take({ at: 'stream' })) {
    switch (frame.type) {
      case 'read':
        answer = frame.conversation;
        break;
      default:
        throw new Error(`a recording opens on reads, not a ${frame.type} frame`);
    }
  }

  const app = OppenheimerApp.create({
    apiBaseUrl: API,
    storage: memory(),
    authClient: signedOut,
    modules: consumerModules,
  });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = render(
    <QueryClientProvider client={queryClient}>
      <OppenheimerProvider app={app}>
        <BotChatScroller>
          <QueryState>
            <QueryState.Pending>
              <p data-replay="pending">loading</p>
            </QueryState.Pending>
            <QueryState.Error fallback="failed" />
            <QueryState.Data>
              <BotTranscript botId={recording.botId} name="Release Bot" />
            </QueryState.Data>
          </QueryState>
        </BotChatScroller>
      </OppenheimerProvider>
    </QueryClientProvider>,
  );
  await settle();

  /**
   * Waits until every read a frame set off has landed and the chat has drawn
   * it: the transcript out of its placeholder (the first read suspends it, and
   * React may start that read after the render it was asked in), no query
   * fetching, then one macrotask, because TanStack Query hands a landed read
   * to its readers on `setTimeout(0)` (`notifyManager`'s default scheduler),
   * after `isFetching` already reads 0.
   */
  async function settle() {
    await waitFor(() => {
      expect(view.container.querySelector('[data-replay="pending"]')).toBeNull();
      expect(queryClient.isFetching()).toBe(0);
    });
    await act(() => new Promise((resolve) => setTimeout(resolve, 0)));
  }

  async function play(frames: readonly BotFrame[]) {
    for (const frame of frames) {
      const source = sources.at(-1);
      switch (frame.type) {
        case 'read':
          answer = frame.conversation;
          continue;
        case 'ready':
          act(() => source?.send(BOT_STREAM_READY, ''));
          break;
        case 'bot':
          act(() => source?.send(BOT_STREAM_EVENT, JSON.stringify(frame.event)));
          break;
        case 'mark':
          continue;
      }
      await settle();
    }
  }

  return {
    ...view,
    /** Plays every frame up to `mark`, and steps past it. */
    async playTo(mark: string) {
      await play(take({ at: 'mark', name: mark }));
      if (cursor >= recording.frames.length) throw new Error(`no mark "${mark}" in the recording`);
      cursor += 1;
    },
    async playAll() {
      await play(take({ at: 'end' }));
    },
    get reads() {
      return reads;
    },
    /** What the chat asked for that the recording does not answer. */
    strays,
    /** The address the chat's stream dialled. */
    get streamUrl() {
      return sources.at(-1)?.url;
    },
  };
}
