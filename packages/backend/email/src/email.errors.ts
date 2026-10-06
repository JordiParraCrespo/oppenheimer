/**
 * The provider refused to send for its rate or its quota, and said, or implied,
 * when it will take mail again. Thrown instead of a plain `Error` so the queue
 * worker can hold the whole queue until `resetAt` rather than spend the job's
 * retries against the same refusal (`.agents/rules/integrations.md`).
 */
export class EmailRateLimitedError extends Error {
  override readonly name = 'EmailRateLimitedError';

  constructor(
    message: string,
    readonly resetAt: Date,
  ) {
    super(message);
  }
}
