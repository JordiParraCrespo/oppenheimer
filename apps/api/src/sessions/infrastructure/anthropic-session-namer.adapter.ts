import { Injectable, Logger } from '@nestjs/common';
import { SessionNamerConfig } from './session-namer.config';
import { SESSION_NAME_MAX_LENGTH, SessionNamerPort } from './session-namer.port';

const MESSAGES_URL = 'https://api.anthropic.com/v1/messages';
/** The version header this endpoint requires. It is a date, not a model. */
const API_VERSION = '2023-06-01';
/** A title is a handful of words; anything larger is a different feature. */
const MAX_TOKENS = 32;
/** Naming is a nicety. It must never be what makes creating a session feel slow. */
const TIMEOUT_MS = 5_000;
/** The prompt itself is capped on the wire; this is what is worth sending of it. */
const PROMPT_MAX_CHARS = 2_000;

/**
 * Names a session by asking the configured model for a title.
 *
 * Over `fetch` rather than a vendor SDK: this is one POST with three headers, and a
 * dependency would buy retries and streaming that a best-effort title has no use
 * for. Every failure is swallowed into `null` — a timeout, a rate limit, a refusal,
 * a shape nobody expected — because the fallback is the session's own slug and a
 * name is not worth failing a request over.
 *
 * The one line that leaves the host is the person's own first prompt, sent under the
 * platform's key. The transcript it was read from never leaves.
 */
@Injectable()
export class AnthropicSessionNamerAdapter extends SessionNamerPort {
  private readonly logger = new Logger(AnthropicSessionNamerAdapter.name);

  constructor(private readonly config: SessionNamerConfig) {
    super();
  }

  isConfigured(): boolean {
    return this.config.isConfigured;
  }

  async nameFor(prompt: string): Promise<string | null> {
    const apiKey = this.config.anthropicApiKey;
    const model = this.config.model;
    if (!apiKey || !model || !prompt.trim()) return null;

    try {
      const response = await fetch(MESSAGES_URL, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': API_VERSION,
        },
        body: JSON.stringify({
          model,
          max_tokens: MAX_TOKENS,
          // Strict, because the answer is written straight into a column: no
          // preamble, no quotes, no trailing period, and a hard character budget.
          system: `Write a title for a software task, from the request that follows. At most ${SESSION_NAME_MAX_LENGTH} characters and at most six words. Reply with the title alone: no quotes, no punctuation at the end, no explanation.`,
          messages: [{ role: 'user', content: prompt.slice(0, PROMPT_MAX_CHARS) }],
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });

      if (!response.ok) {
        this.logger.warn(`The session namer answered ${response.status}; keeping the slug`);
        return null;
      }
      return titleFrom(await response.json());
    } catch (error) {
      this.logger.warn(
        `The session namer could not be reached; keeping the slug: ${(error as Error).message}`,
      );
      return null;
    }
  }
}

/**
 * The first line of text in the answer, cleaned up and capped.
 *
 * Narrowed once, here, so nothing downstream casts: a body that is not the shape
 * this expects reads as "no title", which is the same outcome as a failed call.
 */
export function titleFrom(body: unknown): string | null {
  if (typeof body !== 'object' || body === null) return null;
  const content = (body as { content?: unknown }).content;
  if (!Array.isArray(content)) return null;
  const text = content
    .map((block) =>
      typeof block === 'object' &&
      block !== null &&
      typeof (block as { text?: unknown }).text === 'string'
        ? (block as { text: string }).text
        : '',
    )
    .join('')
    .split('\n')[0]
    ?.trim()
    // A model that answers with a quoted title is answering correctly enough.
    .replace(/^["'`]+|["'`.]+$/g, '')
    .trim();
  if (!text) return null;
  return text.slice(0, SESSION_NAME_MAX_LENGTH);
}
