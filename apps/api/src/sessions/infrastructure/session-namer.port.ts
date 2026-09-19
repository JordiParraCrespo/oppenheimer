/**
 * What names a session from its first prompt.
 *
 * A session's name starts equal to its slug and is replaced by a short title
 * derived from the first user message, which the runner reads out of the agent's own
 * transcript and reports as one event. **Which model does that is configuration, not
 * a decision in the design**: the port has a no-op implementation and a provider
 * one, chosen by `SESSION_NAMER_PROVIDER`, the same abstract-class-plus-factory
 * shape `packages/backend/email` already follows.
 *
 * The contract is deliberately forgiving in one direction: a namer that cannot
 * answer returns `null` rather than throwing, and the session keeps its slug as its
 * name. A failed or absent call costs nothing, which is what makes a deployment with
 * no key a supported configuration rather than a degraded one.
 */
export abstract class SessionNamerPort {
  /** Whether this deployment has a namer at all. False leaves every session its slug. */
  abstract isConfigured(): boolean;

  /**
   * A title of at most {@link SESSION_NAME_MAX_LENGTH} characters for this prompt,
   * or `null` when there is nothing to say.
   *
   * The prompt is the person's own sentence and is the one thing that leaves the
   * host — the transcript itself never does. That is a sentence for the privacy note
   * and the reason a deployment with no provider names nothing.
   */
  abstract nameFor(prompt: string): Promise<string | null>;
}

/** Six words is the brief; forty characters is what a sidebar row can show. */
export const SESSION_NAME_MAX_LENGTH = 40;
