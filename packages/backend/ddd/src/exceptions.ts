/**
 * A framework-agnostic error contract. Modules declare error catalogs of these
 * in their domain layer; `@oppenheimer/backend-core`'s `AppError` turns one into an
 * HTTP exception. `httpStatus` is a plain status number (e.g. 404) so the
 * domain need not depend on any HTTP framework.
 */
export interface ErrorDefinition {
  readonly code: string;
  /**
   * Short summary of the problem type. Becomes the `title` of the RFC 7807
   * problem document, so keep it stable across occurrences — anything specific
   * to one occurrence belongs in `AppError`'s `detail`.
   */
  readonly message: string;
  readonly httpStatus: number;
  /**
   * Optional URI reference identifying the problem type (RFC 7807 `type`).
   * Defaults to the error reference entry derived from `code`, so only set it
   * when an error must point somewhere else.
   */
  readonly type?: string;
}

/**
 * Base domain/application exceptions used by the DDD building blocks.
 *
 * These are framework-agnostic. The HTTP exception filter in
 * `@oppenheimer/backend-core` translates `AppError` (and unknown errors) into HTTP
 * responses; domain exceptions thrown here are surfaced through that filter.
 * `httpStatus` is the status the filter reports for the exception — a plain
 * number, so the domain stays free of any HTTP framework.
 */
export abstract class ExceptionBase extends Error {
  abstract code: string;
  readonly httpStatus: number = 500;

  constructor(
    readonly message: string,
    readonly cause?: Error,
    readonly metadata?: unknown,
  ) {
    super(message);
    Error.captureStackTrace?.(this, this.constructor);
  }

  toJSON() {
    return {
      message: this.message,
      code: this.code,
      stack: this.stack,
      cause: JSON.stringify(this.cause),
      metadata: this.metadata,
    };
  }
}

export class ArgumentInvalidException extends ExceptionBase {
  readonly code = 'GENERIC.ARGUMENT_INVALID';
  readonly httpStatus = 400;
}

export class ArgumentNotProvidedException extends ExceptionBase {
  readonly code = 'GENERIC.ARGUMENT_NOT_PROVIDED';
  readonly httpStatus = 400;
}

export class ArgumentOutOfRangeException extends ExceptionBase {
  readonly code = 'GENERIC.ARGUMENT_OUT_OF_RANGE';
  readonly httpStatus = 400;
}

export class ConflictException extends ExceptionBase {
  readonly code = 'GENERIC.CONFLICT';
  readonly httpStatus = 409;
}

export class NotFoundException extends ExceptionBase {
  static readonly message = 'Not found';
  readonly code = 'GENERIC.NOT_FOUND';
  readonly httpStatus = 404;

  constructor(message = NotFoundException.message) {
    super(message);
  }
}
