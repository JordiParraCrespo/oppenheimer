import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { describeError } from '@oppenheimer/backend-core';
import { DataSource } from 'typeorm';
import {
  DEPENDENCY_UNAVAILABLE,
  type DependencyStatus,
  type ReadinessResponseDto,
} from '../dtos/readiness.response.dto';
import { DependencyTimeoutError, withDeadline } from '../infrastructure/dependency-deadline.util';
import { RedisHealthIndicator } from '../infrastructure/redis-health.adapter';

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
 * Each check answers rather than throws, and only a dependency that answered
 * inside its deadline is up: PostgreSQL is `SELECT 1` on the application's
 * own pool (so a pool that cannot hand out a connection is not ready either),
 * Redis a `PING` on the shared connection. What went wrong is logged; the
 * answer says one word.
 */
@Injectable()
export class ReadinessIndicator {
  private readonly logger = new Logger(ReadinessIndicator.name);

  constructor(
    @Inject(DataSource) private readonly dataSource: DataSource,
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
    try {
      if (!this.dataSource.isInitialized) throw new Error('the data source is not initialized');
      await withDeadline('PostgreSQL', this.databaseTimeoutMs, () =>
        this.dataSource.query('SELECT 1'),
      );
      return up;
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
