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

/** Codes of the invariant failures the building blocks raise themselves. */
export const GenericErrorCode = {
  ARGUMENT_INVALID: 'GENERIC.ARGUMENT_INVALID',
  ARGUMENT_NOT_PROVIDED: 'GENERIC.ARGUMENT_NOT_PROVIDED',
  ARGUMENT_OUT_OF_RANGE: 'GENERIC.ARGUMENT_OUT_OF_RANGE',
  CONFLICT: 'GENERIC.CONFLICT',
  NOT_FOUND: 'GENERIC.NOT_FOUND',
} as const;

/**
 * Base domain/application exceptions used by the DDD building blocks.
 *
 * The HTTP exception filter in `@oppenheimer/backend-core` translates `AppError`
 * (and unknown errors) into HTTP responses; domain exceptions thrown here are
 * surfaced through that filter, with `httpStatus` as the status it reports.
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
    this.name = new.target.name;
  }

  /**
   * The exception for a log line. The cause is reduced to its name and
   * message: serializing it whole would copy whatever fields it carries
   * (a driver error's query parameters, a client's headers) into the log.
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      httpStatus: this.httpStatus,
      stack: this.stack,
      cause: this.cause ? { name: this.cause.name, message: this.cause.message } : undefined,
      metadata: this.metadata,
    };
  }
}

export class ArgumentInvalidException extends ExceptionBase {
  readonly code = GenericErrorCode.ARGUMENT_INVALID;
  readonly httpStatus = 400;
}

export class ArgumentNotProvidedException extends ExceptionBase {
  readonly code = GenericErrorCode.ARGUMENT_NOT_PROVIDED;
  readonly httpStatus = 400;
}

export class ArgumentOutOfRangeException extends ExceptionBase {
  readonly code = GenericErrorCode.ARGUMENT_OUT_OF_RANGE;
  readonly httpStatus = 400;
}

export class ConflictException extends ExceptionBase {
  readonly code = GenericErrorCode.CONFLICT;
  readonly httpStatus = 409;
}

export class NotFoundException extends ExceptionBase {
  static readonly message = 'Not found';
  readonly code = GenericErrorCode.NOT_FOUND;
  readonly httpStatus = 404;

  constructor(message = NotFoundException.message) {
    super(message);
  }
}
