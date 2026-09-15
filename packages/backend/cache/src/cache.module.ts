import { type DynamicModule, Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CacheService } from './cache.service';
import { RedisCacheService } from './redis-cache.service';

@Global()
@Module({})
export class CacheModule {
  static register(): DynamicModule {
    return {
      module: CacheModule,
      providers: [
        {
          provide: CacheService,
          useFactory: (configService: ConfigService) => {
            return new RedisCacheService(configService);
          },
          inject: [ConfigService],
        },
      ],
      exports: [CacheService],
    };
  }
}
