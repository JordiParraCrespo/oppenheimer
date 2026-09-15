import { Logger } from '@nestjs/common';
import type { Logger as TypeOrmLogger } from 'typeorm';

/**
 * TypeORM logger for the opt-in `DB_LOG_QUERIES=true` mode. Bound parameters
 * are dropped from every line — even at debug level — because they carry user
 * data: emails, password hashes, tokens. Only the SQL text is logged.
 *
 * Lines go through Nest's `Logger`, which the bootstrap redirects to pino, so
 * they come out as structured JSON like every other log line.
 */
export class TypeOrmQueryLogger implements TypeOrmLogger {
  private readonly logger = new Logger('TypeORM');

  logQuery(query: string): void {
    this.logger.debug({ message: 'query', query });
  }

  logQueryError(error: string | Error, query: string): void {
    // Driver errors repeat bound values in their message and stack (a
    // unique-violation names the conflicting email, a cast error echoes the
    // rejected input), so neither is logged — only the SQL text and the
    // sanitized driver error code. The full error still surfaces through the
    // exception filter's handling of the failed request.
    const code =
      typeof error === 'object' && error !== null && 'code' in error
        ? String((error as { code: unknown }).code)
        : undefined;
    this.logger.error({ message: 'query failed', query, code });
  }

  logQuerySlow(time: number, query: string): void {
    this.logger.warn({ message: 'slow query', durationMs: time, query });
  }

  logSchemaBuild(message: string): void {
    this.logger.debug({ message });
  }

  logMigration(message: string): void {
    this.logger.log({ message });
  }

  log(level: 'log' | 'info' | 'warn', message: unknown): void {
    if (level === 'warn') {
      this.logger.warn({ message: String(message) });
    } else {
      this.logger.log({ message: String(message) });
    }
  }
}
