import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ExceptionBase } from '@oppenheimer/backend-ddd';
import type { Request, Response } from 'express';
import { ZodValidationException } from 'nestjs-zod';
import type { ZodError, ZodIssue } from 'zod';
import { AppError } from '../errors/app.error';
import {
  buildProblemDetails,
  DEFAULT_ERROR_TYPE_BASE_URL,
  type InvalidParam,
  PROBLEM_JSON_CONTENT_TYPE,
  type ProblemDetails,
  problemTypeFor,
  titleForStatus,
} from '../errors/problem-details';
import { RequestContextService } from '../services/request-context.service';

/** What a 5xx tells the client. Anything more would leak internals. */
const INTERNAL_ERROR_DETAIL =
  'An unexpected error occurred. Quote the correlation id when reporting it.';

/**
 * Translates every exception into an RFC 7807 problem document served as
 * `application/problem+json`.
 *
 * @see https://datatracker.ietf.org/doc/html/rfc7807
 *
 * The five standard members are always present or deliberately omitted:
 * `type` (the catalog entry, or `about:blank` when the status says it all),
 * `title` (stable per problem type), `status`, `detail` (specific to this
 * occurrence) and `instance` (the request path). `code`, `correlationId`,
 * `timestamp` and `invalidParams` are extension members.
 *
 * 5xx responses never carry the underlying message — the correlation id is
 * what ties the client's report back to the logged stack trace.
 */
@Injectable()
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);
  private readonly typeBaseUrl: string;

  constructor(@Optional() configService?: ConfigService) {
    this.typeBaseUrl =
      configService?.get<string>('app.errorTypeBaseUrl') ?? DEFAULT_ERROR_TYPE_BASE_URL;
  }

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const problem = this.toProblemDetails(exception, {
      instance: request?.originalUrl ?? request?.url,
      correlationId: RequestContextService.getCorrelationId(),
    });

    if (problem.status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `${problem.status} on ${problem.instance ?? 'unknown route'}${
          problem.correlationId ? ` [${problem.correlationId}]` : ''
        }`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    response.status(problem.status).contentType(PROBLEM_JSON_CONTENT_TYPE).json(problem);
  }

  /** Exposed for tests and for filters that want to reuse the mapping. */
  toProblemDetails(
    exception: unknown,
    context: { instance?: string; correlationId?: string } = {},
  ): ProblemDetails {
    if (exception instanceof ZodValidationException) {
      return buildProblemDetails(
        {
          status: HttpStatus.BAD_REQUEST,
          type: problemTypeFor('VALIDATION_FAILED', this.typeBaseUrl),
          title: 'Validation failed',
          detail: 'The request body or query string did not match the expected schema.',
          code: 'VALIDATION_FAILED',
          invalidParams: toInvalidParams(exception.getZodError()),
        },
        context,
      );
    }

    if (exception instanceof AppError) {
      return buildProblemDetails(
        {
          status: exception.getStatus(),
          type: exception.type ?? problemTypeFor(exception.code, this.typeBaseUrl),
          title: exception.title,
          detail: exception.detail,
          code: exception.code,
          extensions: exception.extensions,
        },
        context,
      );
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      // A server-side failure keeps its status (a 503 stays a 503) but not its
      // message: only curated catalog errors are safe to hand back verbatim.
      if (status >= HttpStatus.INTERNAL_SERVER_ERROR) return this.internalProblem(context, status);

      const { detail, invalidParams } = readHttpExceptionBody(exception);
      return buildProblemDetails(
        { status, title: titleForStatus(status), detail, invalidParams },
        context,
      );
    }

    // Domain exceptions raised by `@oppenheimer/backend-ddd` carry their own status
    // and code, so they surface as first-class problems instead of a blanket
    // 500 — but only below 5xx, where the message is safe to hand back.
    if (exception instanceof ExceptionBase && exception.httpStatus < 500) {
      return buildProblemDetails(
        {
          status: exception.httpStatus,
          type: problemTypeFor(exception.code, this.typeBaseUrl),
          title: titleForStatus(exception.httpStatus),
          detail: exception.message,
          code: exception.code,
        },
        context,
      );
    }

    return this.internalProblem(context);
  }

  private internalProblem(
    context: { instance?: string; correlationId?: string },
    status: number = HttpStatus.INTERNAL_SERVER_ERROR,
  ): ProblemDetails {
    return buildProblemDetails(
      {
        status,
        title: titleForStatus(status),
        detail: INTERNAL_ERROR_DETAIL,
      },
      context,
    );
  }
}

/** Flattens Zod issues into RFC 7807's `invalid-params` shape. */
function toInvalidParams(error: ZodError): InvalidParam[] {
  return error.issues.map((issue: ZodIssue) => ({
    name: issue.path.length ? issue.path.join('.') : '(root)',
    reason: issue.message,
  }));
}

/**
 * Pulls a detail (and any field errors) out of a framework `HttpException`.
 * Nest's built-in exceptions use `{ message: string | string[] }`, and
 * class-validator puts one entry per failed field in the array.
 */
function readHttpExceptionBody(exception: HttpException): {
  detail?: string;
  invalidParams?: InvalidParam[];
} {
  const body = exception.getResponse();
  if (typeof body === 'string') return { detail: body };

  const { message, error } = body as { message?: unknown; error?: unknown };

  if (Array.isArray(message)) {
    return {
      detail: message.join('; '),
      invalidParams: message.map((reason) => ({
        name: '(body)',
        reason: String(reason),
      })),
    };
  }
  if (typeof message === 'string') return { detail: message };
  if (typeof error === 'string') return { detail: error };
  return {};
}
