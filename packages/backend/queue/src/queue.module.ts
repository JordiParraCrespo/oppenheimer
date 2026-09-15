import { BullModule } from '@nestjs/bullmq';
import { type DynamicModule, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Module({})
export class QueueModule {
  static register(queueNames: string[]): DynamicModule {
    return {
      module: QueueModule,
      imports: [
        BullModule.forRootAsync({
          useFactory: (configService: ConfigService) => ({
            connection: {
              host: configService.get('redis.host'),
              port: configService.get('redis.port'),
            },
          }),
          inject: [ConfigService],
        }),
        ...queueNames.map((name) => BullModule.registerQueue({ name })),
      ],
      exports: [BullModule],
    };
  }
}
