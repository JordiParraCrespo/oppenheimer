import type { ProblemDetails } from '@oppenheimer/shared';
import { describe, expect, it } from 'vitest';
import { createErrorMessageResolver } from '../error-message';
import { AppError, unwrap, unwrapBody } from '../errors';

const CREATE_FAILED = { code: 'SESSIONS_CLIENT_003', message: 'Failed to create session' };

const conflict: ProblemDetails = {
  type: 'https://oppenheimer.dev/errors#sessions_004',
  title: 'Host is offline',
  status: 409,
  detail: 'Host h-1 is not connected',
  code: 'SESSIONS_004',
  correlationId: 'req-9',
};

/** What the generated SDK resolves to for an answered request. */
const answered = <T>(status: number, fields: { data?: T; error?: unknown }) => ({
  ...fields,
  response: new Response(null, { status }),
});

async function rejection(promise: Promise<unknown>): Promise<AppError> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof AppError) return error;
    throw error;
  }
  throw new Error('expected a rejection');
}

describe('unwrap', () => {
  it('returns the body of a successful call', async () => {
    await expect(unwrap(answered(200, { data: { id: 's-1' } }), CREATE_FAILED)).resolves.toEqual({
      id: 's-1',
    });
  });

  it("keeps a refusal's code and status from the problem document", async () => {
    const error = await rejection(unwrap(answered(409, { error: conflict }), CREATE_FAILED));

    expect(error.code).toBe('SESSIONS_004');
    expect(error.status).toBe(409);
    expect(error.correlationId).toBe('req-9');
  });

  it('keeps the status of a refusal that sent no problem document', async () => {
    const error = await rejection(unwrap(answered(502, { error: 'Bad Gateway' }), CREATE_FAILED));

    expect(error.code).toBe(CREATE_FAILED.code);
    expect(error.status).toBe(502);
  });

  it('leaves a network failure without a status', async () => {
    const error = await rejection(
      unwrap({ error: new TypeError('Failed to fetch'), response: undefined }, CREATE_FAILED),
    );

    expect(error.code).toBe(CREATE_FAILED.code);
    expect(error.status).toBeUndefined();
  });

  it('resolves a refusal to its translated code, not to "unreachable"', async () => {
    const resolve = createErrorMessageResolver({
      t: (key) => key,
      translateCode: (code) => (code === 'SESSIONS_004' ? 'That host is offline' : undefined),
    });
    const refused = await rejection(unwrap(answered(409, { error: conflict }), CREATE_FAILED));
    const unreachable = await rejection(
      unwrap({ error: new TypeError('Failed to fetch') }, CREATE_FAILED),
    );

    expect(resolve(refused).message).toBe('That host is offline');
    expect(resolve(unreachable).message).toBe('errors.unreachable');
  });
});

describe('unwrapBody', () => {
  it('treats an empty body as a failed read the server still answered', async () => {
    const error = await rejection(unwrapBody(answered(200, { data: undefined }), CREATE_FAILED));

    expect(error.code).toBe(CREATE_FAILED.code);
    expect(error.status).toBe(200);
  });

  it('treats a body missing what the caller requires as a failed read, with its status', async () => {
    const page = answered(200, { data: { meta: { total: 0 } } as { data?: unknown[] } });
    const error = await rejection(
      unwrapBody(page, CREATE_FAILED, (body) => Array.isArray(body.data)),
    );

    expect(error.status).toBe(200);
  });

  it('passes a failure through with its status', async () => {
    const error = await rejection(unwrapBody(answered(409, { error: conflict }), CREATE_FAILED));

    expect(error.status).toBe(409);
  });
});
