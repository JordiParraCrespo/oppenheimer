import { Injectable, Logger } from '@nestjs/common';
import { LlmService } from '@oppenheimer/backend-llm';
import { cleanModelTitle, SESSION_NAME_MAX_LENGTH } from '../domain/session-name.policy';
import { SessionNamerConfig } from './session-namer.config';
import { SessionNamerPort } from './session-namer.port';

/** A title is a handful of words; anything larger is a different feature. */
const MAX_TOKENS = 32;
/** The prompt itself is capped on the wire; this is what is worth sending of it. */
const PROMPT_MAX_CHARS = 2_000;

/**
 * Names a session by asking the deployment's LLM for a title.
 *
 * Which provider answers — OpenRouter, Together, Anthropic, a local Ollama — is
 * `LLM_PROVIDER`, and none of it is this adapter's business: it builds one
 * request against the shared `LlmService` contract. What *is* its business is
 * the budget. The call carries `SESSION_NAMER_TIMEOUT_MS` as its deadline,
 * because a create waits on it, and every failure — the deadline, a rate limit,
 * an answer with nothing in it — becomes `null`, which the caller turns into a
 * title from the prompt's own words.
 */
@Injectable()
export class LlmSessionNamerAdapter extends SessionNamerPort {
  private readonly logger = new Logger(LlmSessionNamerAdapter.name);

  constructor(
    private readonly llm: LlmService,
    private readonly config: SessionNamerConfig,
  ) {
    super();
  }

  isConfigured(): boolean {
    return this.config.isConfigured;
  }

  async nameFor(prompt: string): Promise<string | null> {
    if (!this.isConfigured() || !prompt.trim()) return null;

    try {
      const completion = await this.llm.complete({
        model: this.config.model,
        // Strict, because the answer is written straight into a column: no
        // preamble, no quotes, no trailing period, and a hard character budget.
        system: `Write a title for a software task, from the request that follows. At most ${SESSION_NAME_MAX_LENGTH} characters and at most six words. Reply with the title alone: no quotes, no punctuation at the end, no explanation.`,
        messages: [{ role: 'user', content: prompt.slice(0, PROMPT_MAX_CHARS) }],
        maxTokens: MAX_TOKENS,
        // Deterministic, because two runs of the same prompt naming a session two
        // different things is noise, not variety.
        temperature: 0,
        timeoutMs: this.config.timeoutMs,
      });
      return cleanModelTitle(completion.text);
    } catch (error) {
      this.logger.warn(
        `No model title; naming the session from its prompt: ${(error as Error).message}`,
      );
      return null;
    }
  }
}
