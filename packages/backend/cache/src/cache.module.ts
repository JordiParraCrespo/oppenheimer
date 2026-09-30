import {
  type DynamicModule,
  type FactoryProvider,
  Global,
  Module,
  type ModuleMetadata,
} from '@nestjs/common';
import type Redis from 'ioredis';
import { CacheService } from './cache.service';
import { type RedisCacheOptions, RedisCacheService } from './redis-cache.service';

export interface CacheModuleOptions extends RedisCacheOptions {
  /** The Redis client to run on; the app owns and closes it (see `RedisCacheService`). */
  client: Redis;
}

export interface CacheModuleAsyncOptions {
  imports?: ModuleMetadata['imports'];
  inject?: FactoryProvider['inject'];
  // biome-ignore lint/suspicious/noExplicitAny: Nest resolves `inject` into these, untyped
  useFactory: (...args: any[]) => CacheModuleOptions | Promise<CacheModuleOptions>;
}

@Global()
@Module({})
export class CacheModule {
  static registerAsync(options: CacheModuleAsyncOptions): DynamicModule {
    return {
      module: CacheModule,
      imports: options.imports ?? [],
      providers: [
        {
          provide: CacheService,
          inject: options.inject ?? [],
          useFactory: async (...args: unknown[]) => {
            const { client, ...cacheOptions } = await options.useFactory(...args);
            return new RedisCacheService(client, cacheOptions);
          },
        },
      ],
      exports: [CacheService],
    };
  }
}
