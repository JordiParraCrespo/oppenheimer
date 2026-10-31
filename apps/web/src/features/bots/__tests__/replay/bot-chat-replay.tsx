import { consumerModules } from '@oppenheimer/frontend-consumer';
import { OppenheimerApp } from '@oppenheimer/frontend-core';
import { OppenheimerProvider } from '@oppenheimer/frontend-core/react';
import { QueryState } from '@oppenheimer/frontend-web';
import { BOT_STREAM_EVENT, BOT_STREAM_READY } from '@oppenheimer/shared/schemas/bot';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render } from '@testing-library/react';
import { vi } from 'vitest';
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
  | { read: unknown }
  /** The stream's `ready` frame: it is live, and the chat reads the conversation again. */
  | { ready: true }
  /** A `bot` frame's data, as the API sent it; one this build cannot read is dropped by the stream. */
  | { bot: unknown }
  /** A point the spec plays to, then looks. */
  | { mark: string };

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

  const take = (until: (frame: BotFrame) => boolean) => {
    const taken: BotFrame[] = [];
    while (cursor < recording.frames.length) {
      const frame = recording.frames[cursor] as BotFrame;
      if (until(frame)) break;
      taken.push(frame);
      cursor += 1;
    }
    return taken;
  };

  // What the API held when the chat opened.
  for (const frame of take((frame) => 'ready' in frame || 'bot' in frame || 'mark' in frame)) {
    if ('read' in frame) answer = frame.read;
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
              <p>loading</p>
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

  /** Lets the reads a frame set off land, and the cache tell its readers. */
  async function settle() {
    for (let tick = 0; tick < 6; tick++) {
      await act(() => new Promise((resolve) => setTimeout(resolve, 0)));
    }
  }

  async function play(frames: readonly BotFrame[]) {
    for (const frame of frames) {
      if ('read' in frame) answer = frame.read;
      const source = sources.at(-1);
      if ('ready' in frame) act(() => source?.send(BOT_STREAM_READY, ''));
      if ('bot' in frame) act(() => source?.send(BOT_STREAM_EVENT, JSON.stringify(frame.bot)));
      await settle();
    }
  }

  return {
    ...view,
    /** Plays every frame up to `mark`, and steps past it. */
    async playTo(mark: string) {
      await play(take((frame) => 'mark' in frame && frame.mark === mark));
      if (cursor >= recording.frames.length) throw new Error(`no mark "${mark}" in the recording`);
      cursor += 1;
    },
    async playAll() {
      await play(take(() => false).filter((frame) => !('mark' in frame)));
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
