import type { ArgumentsHost } from '@nestjs/common';
import { BadRequestException, ForbiddenException, HttpException, HttpStatus } from '@nestjs/common';
import { ConflictException, NotFoundException } from '@oppenheimer/backend-ddd';
import { ZodValidationException } from 'nestjs-zod';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { AppError, type ErrorDefinition } from '../../errors/app.error';
import {
  DEFAULT_PROBLEM_TYPE,
  PROBLEM_JSON_CONTENT_TYPE,
  type ProblemDetails,
} from '../../errors/problem-details';
import { AllExceptionsFilter } from '../all-exceptions.filter';

const USER_NOT_FOUND: ErrorDefinition = {
  code: 'USER_001',
  message: 'User not found',
  httpStatus: 404,
};

/** Captures what the filter wrote, the way express would receive it. */
function capture() {
  const json = vi.fn();
  const contentType = vi.fn().mockReturnValue({ json });
  const status = vi.fn().mockReturnValue({ contentType });
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status }),
      getRequest: () => ({ originalUrl: '/api/v1/users/42' }),
    }),
  } as unknown as ArgumentsHost;

  return {
    host,
    status,
    contentType,
    problem: () => json.mock.calls[0][0] as ProblemDetails,
  };
}

function handle(exception: unknown) {
  const recorder = capture();
  new AllExceptionsFilter().catch(exception, recorder.host);
  return recorder;
}

describe('AllExceptionsFilter', () => {
  it('serves problem documents as application/problem+json', () => {
    const { status, contentType, problem } = handle(new AppError(USER_NOT_FOUND));

    expect(status).toHaveBeenCalledWith(404);
    expect(contentType).toHaveBeenCalledWith(PROBLEM_JSON_CONTENT_TYPE);
    expect(problem().status).toBe(404);
  });

  it('renders a catalog error with its type, title and code', () => {
    const problem = handle(new AppError(USER_NOT_FOUND)).problem();

    expect(problem).toMatchObject({
      type: 'https://oppenheimer.dev/errors#user_001',
      title: 'User not found',
      status: 404,
      instance: '/api/v1/users/42',
      code: 'USER_001',
    });
    expect(problem.timestamp).toEqual(expect.any(String));
  });

  it('keeps the occurrence detail separate from the problem type title', () => {
    const problem = handle(
      new AppError(USER_NOT_FOUND, { detail: 'No user with id 42' }),
    ).problem();

    expect(problem.title).toBe('User not found');
    expect(problem.detail).toBe('No user with id 42');
  });

  it('merges extension members supplied by the thrower', () => {
    const problem = handle(
      new AppError(USER_NOT_FOUND, { extensions: { retryAfter: 30 } }),
    ).problem();

    expect(problem.retryAfter).toBe(30);
  });

  it('does not let an extension overwrite a member the API owns', () => {
    const { status, problem } = handle(
      new AppError(USER_NOT_FOUND, {
        extensions: {
          status: 200,
          title: 'Nothing to see here',
          code: 'NOT_MY_CODE',
          correlationId: 'spoofed',
          retryAfter: 30,
        },
      }),
    );

    expect(status).toHaveBeenCalledWith(404);
    expect(problem()).toMatchObject({
      status: 404,
      title: 'User not found',
      code: 'USER_001',
      retryAfter: 30,
    });
    expect(problem().correlationId).not.toBe('spoofed');
  });

  it('lists every rejected field in invalidParams for a validation failure', () => {
    const schema = z.object({
      email: z.string().email(),
      age: z.number().min(18),
    });
    const result = schema.safeParse({ email: 'nope', age: 12 });
    if (result.success) throw new Error('expected the schema to reject this input');
    const problem = handle(new ZodValidationException(result.error)).problem();

    expect(problem.status).toBe(400);
    expect(problem.code).toBe('VALIDATION_FAILED');
    expect(problem.invalidParams).toEqual([
      { name: 'email', reason: expect.any(String) },
      { name: 'age', reason: expect.any(String) },
    ]);
  });

  it('gives a framework exception the status phrase as its title', () => {
    const problem = handle(new ForbiddenException('Not your token')).problem();

    expect(problem).toMatchObject({
      type: 'about:blank',
      title: 'Forbidden',
      status: 403,
      detail: 'Not your token',
    });
  });

  it('flattens the array of messages a class-validator failure carries', () => {
    const problem = handle(new BadRequestException(['name required', 'scopes required'])).problem();

    expect(problem.detail).toBe('name required; scopes required');
    expect(problem.invalidParams).toHaveLength(2);
  });

  it('surfaces a domain NotFoundException as a 404 rather than a 500', () => {
    const problem = handle(new NotFoundException('Aggregate is gone')).problem();

    expect(problem).toMatchObject({
      status: 404,
      code: 'GENERIC.NOT_FOUND',
      detail: 'Aggregate is gone',
      type: 'https://oppenheimer.dev/errors#generic_not_found',
    });
  });

  it('surfaces a domain ConflictException as a 409', () => {
    expect(handle(new ConflictException('Already exists')).problem().status).toBe(409);
  });

  it('never leaks the message of an unexpected failure', () => {
    const problem = handle(new Error('connection string: postgres://user:hunter2@db')).problem();

    expect(problem.status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(problem.title).toBe('Internal Server Error');
    expect(JSON.stringify(problem)).not.toContain('hunter2');
  });

  it('gives a bare HttpException no code — a code requires a catalog entry', () => {
    // Documented, deliberate behaviour, and the reason the Better Auth façades
    // throw `AppError` rather than passing an upstream `{ message, code }` body
    // through: only curated catalog codes are part of the public contract, so
    // the filter will not lift one off an arbitrary exception body.
    const problem = handle(
      new HttpException({ message: 'Organization slug already taken', code: 'SLUG_TAKEN' }, 409),
    ).problem();

    expect(problem.status).toBe(409);
    expect(problem.title).toBe('Conflict');
    expect(problem.detail).toBe('Organization slug already taken');
    expect(problem.code).toBeUndefined();
    expect(problem.type).toBe(DEFAULT_PROBLEM_TYPE);
  });

  it("carries an AppError's extension members onto the problem document", () => {
    const problem = handle(
      new AppError(
        { code: 'ORG_002', message: 'That organization slug is already taken', httpStatus: 409 },
        {
          detail: 'Organization slug already taken',
          extensions: { upstreamCode: 'ORGANIZATION_SLUG_ALREADY_TAKEN' },
        },
      ),
    ).problem();

    expect(problem).toMatchObject({
      type: 'https://oppenheimer.dev/errors#org_002',
      title: 'That organization slug is already taken',
      status: 409,
      detail: 'Organization slug already taken',
      code: 'ORG_002',
      upstreamCode: 'ORGANIZATION_SLUG_ALREADY_TAKEN',
    });
  });

  it('keeps a 5xx status but not its message', () => {
    const problem = handle(new HttpException('upstream said hunter2', 502)).problem();

    // The status is the caller's business (a readiness probe reads 503 vs 500);
    // the message is not.
    expect(problem.status).toBe(502);
    expect(problem.title).toBe('Bad Gateway');
    expect(JSON.stringify(problem)).not.toContain('hunter2');
  });

  it('still hands back the curated message of a 5xx catalog error', () => {
    const problem = handle(
      new AppError({
        code: 'BILLING_001',
        message: 'Billing is not configured on this server',
        httpStatus: 503,
      }),
    ).problem();

    expect(problem).toMatchObject({
      status: 503,
      title: 'Billing is not configured on this server',
      code: 'BILLING_001',
    });
  });

  it('points type URIs at the configured error reference', () => {
    const configService = {
      get: vi.fn().mockReturnValue('https://errors.acme.test/catalog'),
    };
    const recorder = capture();

    // biome-ignore lint/suspicious/noExplicitAny: a stub standing in for ConfigService
    new AllExceptionsFilter(configService as any).catch(
      new AppError(USER_NOT_FOUND),
      recorder.host,
    );

    expect(recorder.problem().type).toBe('https://errors.acme.test/catalog#user_001');
  });
});
