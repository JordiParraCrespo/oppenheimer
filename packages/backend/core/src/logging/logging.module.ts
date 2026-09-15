import { type DynamicModule, Module, type ModuleMetadata } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';
import { buildPinoHttpOptions, type LoggingOptions } from './pino-http-options';
import { UserContextInterceptor } from './user-context.interceptor';

export interface LoggingModuleAsyncOptions extends Pick<ModuleMetadata, 'imports'> {
  // biome-ignore lint/suspicious/noExplicitAny: mirrors Nest's async-options factory contract
  inject?: any[];
  // biome-ignore lint/suspicious/noExplicitAny: mirrors Nest's async-options factory contract
  useFactory: (...args: any[]) => LoggingOptions | Promise<LoggingOptions>;
}

/**
 * The API's request logger: `nestjs-pino` with hardened defaults (credential
 * redaction, headers/query/body kept out of log lines — see
 * `buildPinoHttpOptions`) plus the `UserContextInterceptor` that attaches the
 * authenticated subject to every request's log context.
 *
 * The app decides only what it legitimately varies — pretty printing — through
 * the async factory; the safety configuration is not overridable.
 */
@Module({})
export class LoggingModule {
  static forRootAsync(options: LoggingModuleAsyncOptions): DynamicModule {
    return {
      module: LoggingModule,
      imports: [
        LoggerModule.forRootAsync({
          imports: options.imports,
          inject: options.inject,
          useFactory: async (...args: unknown[]) => ({
            pinoHttp: buildPinoHttpOptions(await options.useFactory(...args)),
            // Fields added via `PinoLogger.assign` (the user context) must
            // also reach the request-completion line, not only later calls.
            assignResponse: true,
          }),
        }),
      ],
      providers: [{ provide: APP_INTERCEPTOR, useClass: UserContextInterceptor }],
    };
  }
}
