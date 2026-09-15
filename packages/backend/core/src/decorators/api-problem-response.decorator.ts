import { applyDecorators } from '@nestjs/common';
import { ApiExtraModels, ApiResponse, getSchemaPath } from '@nestjs/swagger';
import { ProblemDetailsDto } from '../dtos/problem-details.dto';
import { PROBLEM_JSON_CONTENT_TYPE } from '../errors/problem-details';

export interface ApiProblemResponseOptions {
  status: number;
  /** What went wrong, e.g. `'Token not found'`. */
  description: string;
  /** Catalog code(s) this status can carry, e.g. `'TOKEN_001'`. */
  code?: string | string[];
}

/**
 * Documents an error response as an RFC 7807 problem document.
 *
 * Use it instead of a bare `@ApiResponse` for failures so the OpenAPI document
 * — and therefore the generated client — knows the body is
 * `application/problem+json` shaped like `ProblemDetailsDto`.
 *
 * ```ts
 * @ApiProblemResponse({ status: 404, description: 'Token not found', code: 'TOKEN_001' })
 * ```
 */
export function ApiProblemResponse({ status, description, code }: ApiProblemResponseOptions) {
  const codes = code ? [code].flat() : [];
  return applyDecorators(
    ApiExtraModels(ProblemDetailsDto),
    ApiResponse({
      status,
      description: codes.length ? `${codes.join(' / ')} — ${description}` : description,
      content: {
        [PROBLEM_JSON_CONTENT_TYPE]: {
          schema: { $ref: getSchemaPath(ProblemDetailsDto) },
        },
      },
    }),
  );
}

/**
 * The two failures **every** guarded route can produce, regardless of what it
 * does: the guards reject the credential (401) or the caller's roles/scopes do
 * not permit the operation (403).
 *
 * Apply it once to the controller **class** rather than repeating two
 * decorators on every method — Swagger merges class-level responses into each
 * operation. Method-level `@ApiProblemResponse`s for the same status add to
 * these rather than replacing them, so a route with its own 403 still documents
 * the guard's.
 *
 * ```ts
 * @ApiAuthProblemResponses()
 * @UseGuards(ApiAuthGuard, PoliciesGuard)
 * export class OrganizationsController {}
 * ```
 */
export function ApiAuthProblemResponses() {
  return applyDecorators(
    ApiProblemResponse({
      status: 401,
      description: 'No credential was presented, or it is invalid or expired',
      code: ['AUTH_001', 'TOKEN_003'],
    }),
    ApiProblemResponse({
      status: 403,
      description: "The caller's roles, or their credential's scopes, do not permit this",
      code: ['AUTH_002', 'TOKEN_004', 'TOKEN_005', 'TOKEN_006', 'TOKEN_007'],
    }),
  );
}
