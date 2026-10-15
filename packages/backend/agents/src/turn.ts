import type { BotEngineEvent, BotEngineTool, BotTurnRequest } from './bot-engine';

type DoneEvent = Extract<BotEngineEvent, { type: 'done' }>;

const CANCELLED: DoneEvent = { type: 'done', reason: 'cancelled' };
const MAX_ERROR_LENGTH = 2_000;

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
    case 'text.delta':
    case 'text.done':
      return { ...event, text: scrubTurnText(event.text, request) };
    case 'tool.finished':
      return { ...event, output: scrubTurnText(event.output, request) };
    default:
      return event;
  }
}

export function failed(error: string): DoneEvent {
  return { type: 'done', reason: 'failed', error };
}

/**
 * Runs one of our tools for the model. A throw, or a result that is not the
 * contract's shape, becomes an error result the model reads; it never ends
 * the turn. The result is what both the model and `tool.finished` see, so
 * the request's key is redacted from it here, before either does: a tool
 * failure can echo a key the way a provider error can.
 */
export async function runTool(
  tool: BotEngineTool,
  input: unknown,
  context: { signal: AbortSignal; apiKey: string },
): Promise<{ content: string; isError: boolean }> {
  let content: string;
  let isError: boolean;
  try {
    const result = await tool.run(input, { signal: context.signal });
    content = typeof result?.content === 'string' ? result.content : String(result?.content ?? '');
    isError = result?.isError === true;
  } catch (error) {
    content = describeError(error) || 'The tool failed.';
    isError = true;
  }
  return { content: redactSecret(content, context.apiKey), isError };
}

/**
 * Holds every engine to the stream contract: nothing is thrown, the turn
 * ends with exactly one `done` and nothing follows it, an abort ends it
 * with `cancelled` at once (without waiting for the engine to notice), no
 * error text carries the request's API key, and no text, tool output or
 * error carries the turn's scratch directory.
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
      : failed(scrubSecret(redactPath(describeError(error), request.scratchDir), request.apiKey));
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
