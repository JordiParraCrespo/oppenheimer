import type {
  BotEngineEvent,
  BotEngineFailure,
  BotEngineTool,
  BotToolData,
  BotTurnImage,
  BotTurnRequest,
} from './bot-engine';

type DoneEvent = Extract<BotEngineEvent, { type: 'done' }>;

const CANCELLED: DoneEvent = { type: 'done', reason: 'cancelled' };
const MAX_ERROR_LENGTH = 2_000;

/** One part of a turn's message, before an engine puts it in its SDK's shape. */
export type MessagePart = ({ type: 'image' } & BotTurnImage) | { type: 'text'; text: string };

/**
 * A turn's message as ordered parts: its images in the order they were
 * attached, then its words when it has any (the order Anthropic recommends,
 * and OpenAI reads either way). Each engine maps these onto its own SDK.
 */
export function messageParts(request: Pick<BotTurnRequest, 'message' | 'images'>): MessagePart[] {
  const images = (request.images ?? []).map((image): MessagePart => ({ type: 'image', ...image }));
  return request.message ? [...images, { type: 'text', text: request.message }] : images;
}

/** A thrown value as one line of text, without the stack. */
export function describeError(error: unknown): string {
  if (error instanceof Error) return error.message || error.name;
  if (typeof error === 'string') return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

/** `text` with every occurrence of `secret` replaced, so it can be stored and shown. */
export function redactSecret(text: string, secret: string): string {
  return secret.length >= 4 ? text.split(secret).join('[redacted]') : text;
}

/**
 * `text` with the turn's scratch directory replaced: the path names the
 * machine the control plane runs on, and a bot has no business repeating it.
 */
export function redactPath(text: string, path: string): string {
  return path.length >= 4 ? text.split(path).join('[workspace]') : text;
}

/** What a turn's events may carry: the key and the scratch directory, both redacted. */
function scrubTurnText(text: string, request: Pick<BotTurnRequest, 'apiKey' | 'scratchDir'>) {
  return redactPath(redactSecret(text, request.apiKey), request.scratchDir);
}

/**
 * Streamed text, redacted across chunk boundaries: a chunk's tail that could
 * be the start of the key or the scratch directory is held back until the
 * next chunk shows whether it is, so a secret split over two deltas never
 * goes out in halves.
 */
class DeltaScrubber {
  private held = '';
  private readonly secrets: string[];

  constructor(private readonly request: Pick<BotTurnRequest, 'apiKey' | 'scratchDir'>) {
    this.secrets = [request.apiKey, request.scratchDir].filter((secret) => secret.length >= 4);
  }

  /** What of `text` (after what was held) can go out now. */
  push(text: string): string {
    const scrubbed = scrubTurnText(this.held + text, this.request);
    const keep = this.heldTail(scrubbed);
    this.held = scrubbed.slice(scrubbed.length - keep);
    return scrubbed.slice(0, scrubbed.length - keep);
  }

  /** What is still held: the stream moved on, so it is not the start of a secret. */
  flush(): string {
    const rest = this.held;
    this.held = '';
    return rest;
  }

  /** The length of the longest tail of `text` that begins one of the secrets. */
  private heldTail(text: string): number {
    let longest = 0;
    for (const secret of this.secrets) {
      for (let length = Math.min(secret.length - 1, text.length); length > longest; length--) {
        if (secret.startsWith(text.slice(text.length - length))) {
          longest = length;
          break;
        }
      }
    }
    return longest;
  }
}

/** A tool's input with the key and the scratch directory taken out of every string in it. */
function scrubInput(input: unknown, request: BotTurnRequest): unknown {
  if (typeof input === 'string') return scrubTurnText(input, request);
  if (Array.isArray(input)) return input.map((item) => scrubInput(item, request));
  if (input && typeof input === 'object') {
    return Object.fromEntries(
      Object.entries(input).map(([key, value]) => [key, scrubInput(value, request)]),
    );
  }
  return input;
}

/** An error's text, redacted and cut to a length a chat can show. */
export function scrubSecret(text: string, secret: string): string {
  const scrubbed = redactSecret(text, secret);
  return scrubbed.length > MAX_ERROR_LENGTH ? `${scrubbed.slice(0, MAX_ERROR_LENGTH)}…` : scrubbed;
}

export function toAsync<T>(source: AsyncIterable<T> | Iterable<T>): AsyncIterable<T> {
  if (Symbol.asyncIterator in source) return source;
  return (async function* () {
    yield* source;
  })();
}

/** An event with the key and the scratch directory taken out of every text it carries. */
function scrubEvent(event: BotEngineEvent, request: BotTurnRequest): BotEngineEvent {
  switch (event.type) {
    case 'text.done':
      return { ...event, text: scrubTurnText(event.text, request) };
    case 'tool.started':
      return { ...event, input: scrubInput(event.input, request) };
    case 'tool.finished':
      return event.data
        ? {
            ...event,
            output: scrubTurnText(event.output, request),
            data: scrubInput(event.data, request) as BotToolData,
          }
        : { ...event, output: scrubTurnText(event.output, request) };
    default:
      return event;
  }
}

/**
 * A failed end. A rate limit is that kind whatever `failure` says, and
 * carries when the provider may be called again.
 */
export function failed(
  error: string,
  failure: BotEngineFailure = 'other',
  rateLimit?: { resetAt: Date | null },
): DoneEvent {
  return rateLimit
    ? { type: 'done', reason: 'failed', error, failure: 'rate_limit', rateLimit }
    : { type: 'done', reason: 'failed', error, failure };
}

/**
 * The kind of failure an error thrown by a provider's client is, read from
 * the HTTP status it carries (both SDKs' API errors have `status`) or, with
 * none, from a network failure's name or code. A `429` that names a spent
 * quota (`insufficient_quota`) is the account's limit, not a rate limit.
 */
export function failureOf(error: unknown): BotEngineFailure {
  if (!error || typeof error !== 'object') return 'other';
  const { status, code, name, cause } = error as {
    status?: unknown;
    code?: unknown;
    name?: unknown;
    cause?: unknown;
  };
  if (typeof status === 'number') {
    if (status === 429) return code === 'insufficient_quota' ? 'usage_limit' : 'rate_limit';
    if (status === 402) return 'usage_limit';
    if (status === 401 || status === 403) return 'credential';
    if (status === 400 || status === 404 || status === 413 || status === 422) return 'refused';
    if (status >= 500) return 'unavailable';
    return 'other';
  }
  if (typeof name === 'string' && /Connection|Timeout/.test(name)) return 'unavailable';
  const network = typeof code === 'string' ? code : (cause as { code?: unknown } | null)?.code;
  if (typeof network === 'string' && NETWORK_CODES.has(network)) return 'unavailable';
  // Some clients only say it in words ("connect ECONNREFUSED 10.0.0.1:443").
  const message = error instanceof Error ? error.message : '';
  if ([...NETWORK_CODES].some((spelled) => message.includes(spelled))) return 'unavailable';
  return 'other';
}

const NETWORK_CODES = new Set([
  'ECONNREFUSED',
  'ECONNRESET',
  'ETIMEDOUT',
  'ENOTFOUND',
  'EAI_AGAIN',
  'UND_ERR_CONNECT_TIMEOUT',
  'UND_ERR_SOCKET',
]);

/**
 * When a rate-limit refusal says the provider may be called again: from
 * `retry-after-ms`, or `retry-after` in seconds or as an HTTP date; null
 * when neither is there or readable.
 */
export function resetFromHeaders(
  read: (name: string) => string | null | undefined,
  now = Date.now(),
): Date | null {
  const ms = Number(read('retry-after-ms'));
  if (Number.isFinite(ms) && ms > 0) return new Date(now + ms);
  const after = read('retry-after');
  if (!after) return null;
  const seconds = Number(after);
  if (Number.isFinite(seconds)) return seconds >= 0 ? new Date(now + seconds * 1_000) : null;
  const at = Date.parse(after);
  return Number.isNaN(at) ? null : new Date(at);
}

/**
 * Runs one of our tools for the model. A throw, or a result that is not the
 * contract's shape, becomes an error result the model reads; it never ends
 * the turn. The result is what both the model and `tool.finished` see, so
 * the request's key is redacted from it here, before either does: a tool
 * failure can echo a key the way a provider error can. Its `data` is kept
 * only when it is strings by name.
 */
export async function runTool(
  tool: BotEngineTool,
  input: unknown,
  context: { signal: AbortSignal; apiKey: string; callId?: string },
): Promise<{ content: string; isError: boolean; data?: BotToolData }> {
  let content: string;
  let isError: boolean;
  let data: BotToolData | undefined;
  try {
    const { signal, callId } = context;
    const result = await tool.run(input, callId ? { signal, callId } : { signal });
    content = typeof result?.content === 'string' ? result.content : String(result?.content ?? '');
    isError = result?.isError === true;
    data = toolData(result?.data);
  } catch (error) {
    content = describeError(error) || 'The tool failed.';
    isError = true;
  }
  const redacted = redactSecret(content, context.apiKey);
  return data ? { content: redacted, isError, data } : { content: redacted, isError };
}

function toolData(raw: unknown): BotToolData | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const entries = Object.entries(raw).filter(([, value]) => typeof value === 'string');
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

/**
 * What our tools' calls made, by call id, from the run of each call until
 * the engine reports its end: an SDK's own report of a call carries only
 * its words, so the adapter records the data as it runs the tool.
 */
export class ToolCallData {
  private readonly byCall = new Map<string, BotToolData>();

  record(callId: unknown, data: BotToolData | undefined): void {
    if (typeof callId === 'string' && data) this.byCall.set(callId, data);
  }

  /** The call's data, handed out once. */
  take(callId: string): BotToolData | undefined {
    const data = this.byCall.get(callId);
    this.byCall.delete(callId);
    return data;
  }
}

/**
 * Holds every engine to the stream contract: nothing is thrown, the turn
 * ends with exactly one `done` and nothing follows it, an abort ends it
 * with `cancelled` at once (without waiting for the engine to notice), no
 * error text carries the request's API key, and no text, tool input, tool
 * output or error carries the key or the turn's scratch directory, streamed
 * text included, however the engine splits it into deltas.
 */
export async function* guardTurn(
  request: BotTurnRequest,
  open: () => AsyncIterable<BotEngineEvent> | Iterable<BotEngineEvent>,
): AsyncGenerator<BotEngineEvent, void, undefined> {
  const { signal } = request;
  if (signal.aborted) {
    yield CANCELLED;
    return;
  }

  const deltas = new DeltaScrubber(request);
  let iterator: AsyncIterator<BotEngineEvent> | undefined;
  let onAbort: (() => void) | undefined;
  const aborted = new Promise<'aborted'>((resolve) => {
    onAbort = () => resolve('aborted');
    signal.addEventListener('abort', onAbort, { once: true });
  });

  try {
    iterator = toAsync(open())[Symbol.asyncIterator]();
    while (true) {
      const pending = iterator.next();
      // A step still pending when the turn is cancelled may reject later.
      pending.catch(() => undefined);
      const next = await Promise.race([pending, aborted]);
      if (next === 'aborted') {
        yield CANCELLED;
        return;
      }
      if (next.done) {
        yield signal.aborted ? CANCELLED : failed('The engine ended the turn without an outcome.');
        return;
      }
      const event = next.value;
      if (event.type === 'text.delta') {
        const text = deltas.push(event.text);
        if (text) yield { type: 'text.delta', text };
        continue;
      }
      const held = deltas.flush();
      if (held) yield { type: 'text.delta', text: held };
      if (event.type === 'done') {
        if (signal.aborted) yield CANCELLED;
        else if (event.error !== undefined)
          yield {
            ...event,
            error: scrubSecret(redactPath(event.error, request.scratchDir), request.apiKey),
          };
        else yield event;
        return;
      }
      yield scrubEvent(event, request);
    }
  } catch (error) {
    yield signal.aborted
      ? CANCELLED
      : failed(
          scrubSecret(redactPath(describeError(error), request.scratchDir), request.apiKey),
          failureOf(error),
        );
  } finally {
    if (onAbort) signal.removeEventListener('abort', onAbort);
    // Lets the engine release what it holds; a generator still busy with a
    // step returns once that step settles, so this is not awaited.
    if (iterator?.return) {
      Promise.resolve()
        .then(() => iterator?.return?.())
        .catch(() => undefined);
    }
  }
}
