/** How bad a reported error is. `warning` is for a failure we handled but want to see. */
export type ErrorReportLevel = 'fatal' | 'error' | 'warning';

/** A tag's value: searchable and groupable in the error tracker, so short and plain. */
export type ErrorReportTag = string | number | boolean | null | undefined;

/** What the reporter is told about an error besides the error itself. */
export interface ErrorReportContext {
  /** `error` when left out. */
  readonly level?: ErrorReportLevel;
  /** Searchable keys: a queue, a job name, a route, a provider. A nullish value is dropped. */
  readonly tags?: Readonly<Record<string, ErrorReportTag>>;
  /** Detail shown on the event and not indexed. Never a secret, a prompt or terminal output. */
  readonly extra?: Readonly<Record<string, unknown>>;
  /**
   * How events group into one issue. Left out, the tracker groups by stack
   * trace; set it when one cause throws from many places (a catalog code).
   */
  readonly fingerprint?: readonly string[];
  /** The account the error happened to: its id only, never an email. */
  readonly userId?: string | null;
  /** The workspace (Better Auth organization) the error happened in. */
  readonly workspaceId?: string | null;
}

/**
 * Where the API reports an error a person should look at: an unexpected 5xx, a
 * job that ran out of retries, a bot turn that failed for a reason we did not
 * foresee. Logging still happens beside it; this is what pages someone.
 *
 * Injected as this abstract class. `ErrorReportingModule` provides the Sentry
 * driver when `initErrorReporting` started it, and a no-op otherwise, so a
 * caller never checks whether reporting is on.
 */
export abstract class ErrorReporter {
  /** Whether reports go anywhere. */
  abstract readonly enabled: boolean;

  /** Reports `error`, and returns the event's id when one was sent. */
  abstract capture(error: unknown, context?: ErrorReportContext): string | undefined;

  /** Waits up to `timeoutMs` for queued reports to send; false when they did not. */
  abstract flush(timeoutMs?: number): Promise<boolean>;
}
