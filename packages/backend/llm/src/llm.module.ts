import { type DynamicModule, type FactoryProvider, Global, Logger, Module } from '@nestjs/common';
import { createLlmService } from './llm.factory';
import { LlmService } from './llm.service';
import type { LlmConfig } from './llm.types';

export interface LlmModuleAsyncOptions {
  inject?: FactoryProvider['inject'];
  useFactory: (...args: never[]) => LlmConfig | Promise<LlmConfig>;
}

/**
 * Binds {@link LlmService} to the configured provider, globally.
 *
 * The configuration is handed in rather than read from a fixed `ConfigService`
 * key, so the app decides which environment variables feed it.
 */
@Global()
@Module({})
export class LlmModule {
  static forRoot(config: LlmConfig): DynamicModule {
    return LlmModule.forRootAsync({ useFactory: () => config });
  }

  static forRootAsync(options: LlmModuleAsyncOptions): DynamicModule {
    return {
      module: LlmModule,
      providers: [
        {
          provide: LlmService,
          inject: options.inject ?? [],
          useFactory: async (...args: never[]) => {
            const config = await options.useFactory(...args);
            const service = createLlmService(config);
            const logger = new Logger(LlmModule.name);
            if (config.provider === 'none') {
              logger.log('No LLM provider configured');
            } else if (!service.isConfigured()) {
              logger.warn(
                `LLM provider "${config.provider}" is missing its key or base URL; every call will fall back`,
              );
            } else {
              logger.log(
                `LLM provider: ${config.provider} (default model: ${config.model ?? 'none'})`,
              );
            }
            return service;
          },
        },
      ],
      exports: [LlmService],
    };
  }
}
