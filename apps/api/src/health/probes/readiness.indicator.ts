import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmHealthIndicator } from '@nestjs/terminus';
import { describeError } from '@oppenheimer/backend-core';
import {
  DEPENDENCY_UNAVAILABLE,
  type DependencyStatus,
  type ReadinessResponseDto,
} from '../dtos/readiness.response.dto';
import { DependencyTimeoutError, withDeadline } from '../infrastructure/dependency-deadline.util';
import { RedisHealthIndicator } from '../infrastructure/redis-health.adapter';

const DATABASE = 'database';
const up: DependencyStatus = Object.freeze({ status: 'ok' });
const unavailable: DependencyStatus = Object.freeze({
  status: 'error',
  message: DEPENDENCY_UNAVAILABLE,
});

/**
 * Whether this replica can serve: PostgreSQL and Redis, each within its own
 * deadline, checked concurrently, so the probe's worst case is the longer
 * timeout and not their sum.
 *
 * Each check answers rather than throws, and only an explicit `up` is up:
 * Terminus reports a failed ping by *resolving* with `down`, and a result of
 * a shape this code does not recognise is not evidence of a working
 * database. What went wrong is logged; the answer says one word.
 */
@Injectable()
export class ReadinessIndicator {
  private readonly logger = new Logger(ReadinessIndicator.name);

  constructor(
    private readonly database: TypeOrmHealthIndicator,
    private readonly redis: RedisHealthIndicator,
    private readonly configService: ConfigService,
  ) {}

  async check(): Promise<ReadinessResponseDto> {
    const [database, redis] = await Promise.all([this.checkDatabase(), this.checkRedis()]);
    const checks = { database, redis };
    const ready = Object.values(checks).every((check) => check.status === 'ok');
    return { status: ready ? 'ok' : 'error', checks };
  }

  private async checkDatabase(): Promise<DependencyStatus> {
    const timeoutMs = this.databaseTimeoutMs;
    try {
      // Terminus gets the bound too, so its `down` names the timeout it used;
      // the outer deadline is what guarantees an answer.
      const result = await withDeadline('PostgreSQL', timeoutMs, () =>
        this.database.pingCheck(DATABASE, { timeout: timeoutMs }),
      );
      const detail = (
        result as Record<string, { status?: unknown; message?: unknown }> | undefined
      )?.[DATABASE];
      if (detail?.status === 'up') return up;
      this.logger.error({
        message: 'Readiness: PostgreSQL is not up',
        reported: typeof detail?.status === 'string' ? detail.status : 'no result',
        ...(typeof detail?.message === 'string' ? { detail: detail.message } : {}),
      });
      return unavailable;
    } catch (error) {
      return this.failed('PostgreSQL', error);
    }
  }

  private async checkRedis(): Promise<DependencyStatus> {
    try {
      await withDeadline('Redis', this.redisTimeoutMs, () => this.redis.ping());
      return up;
    } catch (error) {
      return this.failed('Redis', error);
    }
  }

  private failed(dependency: string, error: unknown): DependencyStatus {
    if (error instanceof DependencyTimeoutError) {
      this.logger.error({
        message: `Readiness: ${dependency} timed out`,
        timeoutMs: error.timeoutMs,
      });
    } else {
      this.logger.error(
        { message: `Readiness: ${dependency} failed`, error: describeError(error) },
        error instanceof Error ? error.stack : undefined,
      );
    }
    return unavailable;
  }

  private get databaseTimeoutMs(): number {
    return this.configService.getOrThrow<number>('health.databaseTimeoutMs');
  }

  private get redisTimeoutMs(): number {
    return this.configService.getOrThrow<number>('health.redisTimeoutMs');
  }
}
