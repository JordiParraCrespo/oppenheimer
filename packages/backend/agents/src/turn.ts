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

/** `text` with every occurrence of `secret` replaced, so an error can be stored and shown. */
export function scrubSecret(text: string, secret: string): string {
  const scrubbed = secret.length >= 4 ? text.split(secret).join('[redacted]') : text;
  return scrubbed.length > MAX_ERROR_LENGTH ? `${scrubbed.slice(0, MAX_ERROR_LENGTH)}…` : scrubbed;
}

export function toAsync<T>(source: AsyncIterable<T> | Iterable<T>): AsyncIterable<T> {
  if (Symbol.asyncIterator in source) return source;
  return (async function* () {
    yield* source;
  })();
}

export function failed(error: string): DoneEvent {
  return { type: 'done', reason: 'failed', error };
}

/**
 * Runs one of our tools for the model. A throw, or a result that is not the
 * contract's shape, becomes an error result the model reads; it never ends
 * the turn.
 */
export async function runTool(
  tool: BotEngineTool,
  input: unknown,
  signal: AbortSignal,
): Promise<{ content: string; isError: boolean }> {
  try {
    const result = await tool.run(input, { signal });
    const content =
      typeof result?.content === 'string' ? result.content : String(result?.content ?? '');
    return { content, isError: result?.isError === true };
  } catch (error) {
    return { content: describeError(error) || 'The tool failed.', isError: true };
  }
}

/**
 * Holds every engine to the stream contract: nothing is thrown, the turn
 * ends with exactly one `done` and nothing follows it, an abort ends it
 * with `cancelled` at once (without waiting for the engine to notice), and
 * no error text carries the request's API key.
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
          yield { ...event, error: scrubSecret(event.error, request.apiKey) };
        else yield event;
        return;
      }
      yield event;
    }
  } catch (error) {
    yield signal.aborted ? CANCELLED : failed(scrubSecret(describeError(error), request.apiKey));
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
