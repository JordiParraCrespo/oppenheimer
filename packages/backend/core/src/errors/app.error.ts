import { HttpException } from '@nestjs/common';
import { type ErrorDefinition } from '@oppenheimer/backend-ddd';

export type { ErrorDefinition };

export interface AppErrorOptions {
  /**
   * Explanation specific to *this* occurrence (RFC 7807 `detail`). The
   * catalog's message stays the problem `title`, so put ids, counts and
   * anything else that varies between occurrences here.
   */
  detail?: string;
  /** Extra members merged into the problem document (RFC 7807 §3.2). */
  extensions?: Record<string, unknown>;
  /** The underlying error, kept for logs — never serialised to the client. */
  cause?: unknown;
}

/**
 * An error from a module's catalog, rendered as an RFC 7807 problem document
 * by `AllExceptionsFilter`.
 *
 * ```ts
 * throw new AppError(UserErrors.NOT_FOUND, { detail: `No user with id ${id}` });
 * ```
 */
export class AppError extends HttpException {
  public readonly code: string;
  /** Stable summary of the problem type — the catalog message. */
  public readonly title: string;
  public readonly detail?: string;
  /** Explicit problem type URI, when the catalog entry overrides the default. */
  public readonly type?: string;
  public readonly extensions: Record<string, unknown>;

  constructor(error: ErrorDefinition, options: AppErrorOptions = {}) {
    super(
      {
        code: error.code,
        message: error.message,
        ...(options.detail && { detail: options.detail }),
      },
      error.httpStatus,
      { cause: options.cause instanceof Error ? options.cause : undefined },
    );
    this.code = error.code;
    this.title = error.message;
    this.detail = options.detail;
    this.type = error.type;
    this.extensions = options.extensions ?? {};
  }
}
