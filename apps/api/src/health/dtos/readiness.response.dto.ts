import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export type ProbeStatus = 'ok' | 'error';
export const PROBE_STATUSES: readonly ProbeStatus[] = ['ok', 'error'];

/**
 * The only reason a readiness answer gives for a dependency it could not use.
 * The probe is public, so a driver message, a host, a port or a refused
 * credential never reaches it: the log carries those. Typing the field as
 * this one value makes leaking a message a compile error.
 */
export const DEPENDENCY_UNAVAILABLE = 'unavailable';

export interface DependencyStatus {
  status: ProbeStatus;
  message?: typeof DEPENDENCY_UNAVAILABLE;
}

export class DependencyStatusDto implements DependencyStatus {
  @ApiProperty({
    enum: PROBE_STATUSES,
    description: '`ok` when the dependency answered in time, `error` otherwise.',
  })
  status!: ProbeStatus;

  @ApiPropertyOptional({
    enum: [DEPENDENCY_UNAVAILABLE],
    description:
      'Present only with `error`, and always this one word. Why it failed is in the API log, never here.',
  })
  message?: typeof DEPENDENCY_UNAVAILABLE;
}

export class ReadinessChecksDto {
  @ApiProperty({
    type: DependencyStatusDto,
    description: 'PostgreSQL, proved by a ping within `HEALTH_DATABASE_TIMEOUT_MS`.',
  })
  database!: DependencyStatusDto;

  @ApiProperty({
    type: DependencyStatusDto,
    description: 'Redis, proved by a `PING` within `HEALTH_REDIS_TIMEOUT_MS`.',
  })
  redis!: DependencyStatusDto;
}

export class ReadinessResponseDto {
  @ApiProperty({
    enum: PROBE_STATUSES,
    description: '`ok` only when every check is `ok`; served with 200, and `error` with 503.',
  })
  status!: ProbeStatus;

  @ApiProperty({ type: ReadinessChecksDto })
  checks!: ReadinessChecksDto;
}

export class LivenessResponseDto {
  @ApiProperty({ enum: ['ok'], description: 'Always `ok`: the process answered.' })
  status!: 'ok';
}
