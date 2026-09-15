import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** One field-level validation failure inside a problem document. */
export class InvalidParamDto {
  @ApiProperty({
    example: 'email',
    description: 'Dotted path to the offending field',
  })
  name!: string;

  @ApiProperty({
    example: 'Invalid email',
    description: 'Why the value was rejected',
  })
  reason!: string;
}

/**
 * RFC 7807 problem document — the body of every error response.
 *
 * @see https://datatracker.ietf.org/doc/html/rfc7807
 */
export class ProblemDetailsDto {
  @ApiProperty({
    example: 'https://oppenheimer.dev/errors#user_001',
    description:
      'URI reference identifying the problem type. `about:blank` when the status code says everything.',
  })
  type!: string;

  @ApiProperty({
    example: 'User not found',
    description: 'Short summary, stable per problem type',
  })
  title!: string;

  @ApiProperty({ example: 404, description: 'HTTP status code' })
  status!: number;

  @ApiPropertyOptional({
    example: 'No user with id 3f1c…',
    description: 'Explanation specific to this occurrence',
  })
  detail?: string;

  @ApiPropertyOptional({
    example: '/api/v1/users/3f1c',
    description: 'URI reference of the specific occurrence — the request path',
  })
  instance?: string;

  @ApiPropertyOptional({
    example: 'USER_001',
    description: 'Machine-readable catalog code',
  })
  code?: string;

  @ApiPropertyOptional({
    description: 'Correlation id of the request, for log lookups',
  })
  correlationId?: string;

  @ApiPropertyOptional({
    example: '2026-01-01T00:00:00.000Z',
    description: 'When it happened',
  })
  timestamp?: string;

  @ApiPropertyOptional({
    type: [InvalidParamDto],
    description: 'Per-field validation failures',
  })
  invalidParams?: InvalidParamDto[];
}
