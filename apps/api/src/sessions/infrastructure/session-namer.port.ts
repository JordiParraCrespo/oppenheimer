/**
 * What asks a model to title a session from its first prompt.
 *
 * The contract is deliberately forgiving in one direction: a namer that cannot
 * answer — no provider, no model, a timeout, a rate limit, an answer with
 * nothing in it — returns `null` rather than throwing, and the caller names the
 * session from the prompt's own words instead (`domain/session-name.policy.ts`).
 */
export abstract class SessionNamerPort {
  /** Whether a model names sessions on this deployment. */
  abstract isConfigured(): boolean;

  /**
   * A cleaned title for this prompt, or `null` when there is none to be had
   * within the naming budget.
   *
   * The prompt is the person's own sentence and is the one thing that leaves the
   * host — the transcript itself never does.
   */
  abstract nameFor(prompt: string): Promise<string | null>;
}
