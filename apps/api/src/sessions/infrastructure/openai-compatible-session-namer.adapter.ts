import { Injectable, Logger } from '@nestjs/common';
import { SessionNamerConfig } from './session-namer.config';
import { SESSION_NAME_MAX_LENGTH, SessionNamerPort } from './session-namer.port';

/** A title is a handful of words; anything larger is a different feature. */
const MAX_TOKENS = 32;
/** Naming is a nicety. It must never be what makes creating a session feel slow. */
const TIMEOUT_MS = 5_000;
/** The prompt itself is capped on the wire; this is what is worth sending of it. */
const PROMPT_MAX_CHARS = 2_000;

/**
 * Names a session with any server that speaks OpenAI's chat-completions shape.
 *
 * **One adapter, most of the field.** Groq, Together, Fireworks, DeepInfra,
 * OpenRouter, a vLLM deployment and a local Ollama all serve
 * `POST {baseUrl}/chat/completions` with the same body, so "name a session with a
 * fast open-weights model" is a matter of three environment variables rather than
 * a vendor adapter each (`product/versions/mvp/12-session-launch.md`). It is also
 * what makes a self-hosted, nothing-leaves-the-building deployment possible: point
 * it at a model on your own machine and the prompt never crosses the network.
 *
 * The key is **optional** here and required nowhere else: a local server
 * routinely wants none, and demanding one would rule out exactly the deployment
 * this adapter exists for.
 *
 * Over `fetch` rather than a vendor SDK, and every failure swallowed into `null` —
 * a timeout, a rate limit, a refusal, a shape nobody expected — because the
 * fallback is the session's own slug and a name is not worth failing a request
 * over. That posture is copied from the Anthropic adapter deliberately: two namers
 * that fail differently would be two behaviours to reason about.
 */
@Injectable()
export class OpenAiCompatibleSessionNamerAdapter extends SessionNamerPort {
  private readonly logger = new Logger(OpenAiCompatibleSessionNamerAdapter.name);

  constructor(private readonly config: SessionNamerConfig) {
    super();
  }

  isConfigured(): boolean {
    return this.config.isConfigured;
  }

  async nameFor(prompt: string): Promise<string | null> {
    const baseUrl = this.config.baseUrl;
    const model = this.config.model;
    if (!baseUrl || !model || !prompt.trim()) return null;

    try {
      const response = await fetch(`${baseUrl.replace(/\/+$/, '')}/chat/completions`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          // A server that wants no key gets no header, rather than an empty one:
          // some reject `Authorization: Bearer` with nothing after it.
          ...(this.config.apiKey ? { authorization: `Bearer ${this.config.apiKey}` } : {}),
        },
        body: JSON.stringify({
          model,
          max_tokens: MAX_TOKENS,
          // Deterministic, because two runs of the same prompt naming a session two
          // different things is noise, not variety.
          temperature: 0,
          messages: [
            {
              role: 'system',
              // Strict, because the answer is written straight into a column: no
              // preamble, no quotes, no trailing period, and a hard budget.
              content: `Write a title for a software task, from the request that follows. At most ${SESSION_NAME_MAX_LENGTH} characters and at most six words. Reply with the title alone: no quotes, no punctuation at the end, no explanation.`,
            },
            { role: 'user', content: prompt.slice(0, PROMPT_MAX_CHARS) },
          ],
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
 * The first line of the first choice, cleaned up and capped.
 *
 * Narrowed once, here, so nothing downstream casts: a body that is not the shape
 * this expects reads as "no title", which is the same outcome as a failed call.
 * That matters more for this adapter than for a single-vendor one — the servers it
 * talks to are many, and one of them answering something unexpected must not be an
 * exception in a path nobody is awaiting.
 *
 * A reasoning model that answers with a `<think>` block has that block removed
 * rather than truncated into the name: the open-weights models this adapter is for
 * are the ones that do it.
 */
export function titleFrom(body: unknown): string | null {
  if (typeof body !== 'object' || body === null) return null;
  const choices = (body as { choices?: unknown }).choices;
  if (!Array.isArray(choices)) return null;
  const message = (choices[0] as { message?: unknown } | undefined)?.message;
  if (typeof message !== 'object' || message === null) return null;
  const content = (message as { content?: unknown }).content;
  if (typeof content !== 'string') return null;

  const text = content
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.length > 0)
    // A model that answers with a quoted title is answering correctly enough.
    ?.replace(/^["'`]+|["'`.]+$/g, '')
    .trim();
  if (!text) return null;
  return text.slice(0, SESSION_NAME_MAX_LENGTH);
}
