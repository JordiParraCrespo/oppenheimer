import type { LoggerService } from '@nestjs/common';

/**
 * The contexts in which Nest lists, at every boot, each module it loaded and
 * each route it mapped: some 700 lines per API start, nearly half of what the
 * API logged on a day of deploys.
 */
const BOOT_LISTING_CONTEXTS = new Set(['InstanceLoader', 'RoutesResolver', 'RouterExplorer']);

/**
 * The app's logger, with Nest's boot listing moved from info to debug: still
 * there with `level: 'debug'`, out of the way otherwise. Everything else
 * passes through unchanged. Nest passes the context as the last parameter.
 */
export class QuietBootLogger implements LoggerService {
  constructor(private readonly inner: LoggerService) {}

  log(message: unknown, ...params: unknown[]): void {
    const context = params.at(-1);
    if (typeof context === 'string' && BOOT_LISTING_CONTEXTS.has(context) && this.inner.debug) {
      this.inner.debug(message, ...params);
      return;
    }
    this.inner.log(message, ...params);
  }

  error(message: unknown, ...params: unknown[]): void {
    this.inner.error(message, ...params);
  }

  warn(message: unknown, ...params: unknown[]): void {
    this.inner.warn(message, ...params);
  }

  debug(message: unknown, ...params: unknown[]): void {
    this.inner.debug?.(message, ...params);
  }

  verbose(message: unknown, ...params: unknown[]): void {
    this.inner.verbose?.(message, ...params);
  }

  fatal(message: unknown, ...params: unknown[]): void {
    this.inner.fatal?.(message, ...params);
  }
}
