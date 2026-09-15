import { type DynamicModule, Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LocalStorageService } from './local-storage.service';
import { S3StorageService } from './s3-storage.service';
import { StorageService } from './storage.service';

@Global()
@Module({})
export class StorageModule {
  static register(): DynamicModule {
    return {
      module: StorageModule,
      providers: [
        {
          provide: StorageService,
          useFactory: (configService: ConfigService) => {
            const provider = configService.get('storage.provider') || 'local';
            switch (provider) {
              case 's3':
                return new S3StorageService(configService);
              default:
                return new LocalStorageService(configService);
            }
          },
          inject: [ConfigService],
        },
      ],
      exports: [StorageService],
    };
  }
}
