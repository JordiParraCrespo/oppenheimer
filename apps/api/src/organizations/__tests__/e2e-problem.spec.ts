import type { ArgumentsHost } from '@nestjs/common';
import { AllExceptionsFilter, AppError } from '@oppenheimer/backend-core';
import { APIError } from 'better-auth/api';
import { describe, expect, it, vi } from 'vitest';
import { AuthErrors } from '../../auth/domain/auth.errors';
import { invokeOrganizationApi } from '../organization-error.mapper';

/**
 * The whole chain, end to end: a failure raised deep in a delegated Better Auth
 * call comes out of the global filter as a problem document a client can act on.
 *
 * The unit tests either side of this cover the mapper and the filter
 * separately; this one exists because the bug it guards against lived exactly in
 * the seam — the façade threw an `HttpException` carrying `{ message, code }`,
 * and the filter, which only reads a `code` off an `AppError`, dropped it. Every
 * piece was individually correct and the response still had no `code`.
 */
function render(exception: unknown) {
  const json = vi.fn();
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({
        status: () => ({ contentType: () => ({ json }) }),
      }),
      getRequest: () => ({ originalUrl: '/api/v1/organizations' }),
    }),
  } as unknown as ArgumentsHost;

  new AllExceptionsFilter().catch(exception, host);
  return json.mock.calls[0][0];
}

describe('façade failure → problem document', () => {
  it('renders a Better Auth slug conflict as a documented ORG_002 problem', async () => {
    const err = await invokeOrganizationApi(() =>
      Promise.reject(
        new APIError('CONFLICT', {
          message: 'Organization slug already taken',
          code: 'ORGANIZATION_SLUG_ALREADY_TAKEN',
        }),
      ),
    ).catch((e: unknown) => e);

    expect(render(err)).toMatchObject({
      // Dereferenceable: the anchor exists in apps/docs/docs/errors.md.
      type: 'https://oppenheimer.dev/errors#org_002',
      title: 'That organization slug is already taken',
      status: 409,
      // Better Auth's wording survives as the per-occurrence detail...
      detail: 'Organization slug already taken',
      // ...its code as a diagnostic extension, and ours as the contract.
      code: 'ORG_002',
      upstreamCode: 'ORGANIZATION_SLUG_ALREADY_TAKEN',
      instance: '/api/v1/organizations',
    });
  });

  it('renders a guard rejection as a documented AUTH_002 problem', () => {
    expect(render(new AppError(AuthErrors.FORBIDDEN))).toMatchObject({
      type: 'https://oppenheimer.dev/errors#auth_002',
      title: 'You do not have permission to perform this action',
      status: 403,
      code: 'AUTH_002',
    });
  });
});
