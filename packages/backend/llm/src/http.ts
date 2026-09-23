import { LlmError } from './llm.errors';
import type { LlmProviderId } from './llm.types';

/**
 * One JSON POST with a deadline, and every way it can fail turned into an
 * {@link LlmError}.
 *
 * The deadline covers reading the body as well as the headers: the signal is
 * handed to `fetch`, and `response.json()` rejects when it fires. That is what
 * makes `timeoutMs` an end-to-end budget rather than a connect timeout.
 *
 * Over `fetch` rather than a vendor SDK: every provider here is one POST, and a
 * dependency per vendor would buy retries and streaming nothing uses yet.
 */
export async function postJson(
  provider: LlmProviderId,
  url: string,
  headers: Record<string, string>,
  body: unknown,
  options: { timeoutMs?: number; signal?: AbortSignal },
): Promise<unknown> {
  const signals: AbortSignal[] = [];
  if (options.signal) signals.push(options.signal);
  if (options.timeoutMs && options.timeoutMs > 0) {
    signals.push(AbortSignal.timeout(options.timeoutMs));
  }
  const signal = signals.length > 0 ? AbortSignal.any(signals) : undefined;

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal,
    });
  } catch (error) {
    throw failureFrom(provider, error, options);
  }

  if (!response.ok) {
    // The body is read for the message only; a provider's error shape is not
    // worth modelling, and a body that will not read is not worth failing on.
    let detail = '';
    try {
      detail = await response.text();
    } catch (error) {
      // A stalled body that the deadline or the caller cut off is a timeout or a
      // cancellation, not an HTTP failure a caller might retry on status.
      if (signal?.aborted) throw failureFrom(provider, error, options);
    }
    throw new LlmError(
      'http',
      provider,
      `${provider} answered ${response.status}${detail ? `: ${detail.slice(0, 300)}` : ''}`,
      response.status,
    );
  }

  try {
    return await response.json();
  } catch (error) {
    if (signal?.aborted) throw failureFrom(provider, error, options);
    throw new LlmError(
      'invalid_response',
      provider,
      `${provider} answered a body that is not JSON`,
      undefined,
      {
        cause: error,
      },
    );
  }
}

/** A thrown `fetch` is a timeout, the caller's cancellation, or the network. */
function failureFrom(
  provider: LlmProviderId,
  error: unknown,
  options: { timeoutMs?: number; signal?: AbortSignal },
): LlmError {
  const name = (error as { name?: unknown } | null)?.name;
  if (name === 'TimeoutError') {
    return new LlmError(
      'timeout',
      provider,
      `${provider} did not answer within ${options.timeoutMs}ms`,
      undefined,
      {
        cause: error,
      },
    );
  }
  if (name === 'AbortError' || options.signal?.aborted) {
    return new LlmError('aborted', provider, `The call to ${provider} was cancelled`, undefined, {
      cause: error,
    });
  }
  return new LlmError(
    'network',
    provider,
    `${provider} could not be reached: ${(error as Error)?.message ?? String(error)}`,
    undefined,
    { cause: error },
  );
}
