import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OutboxMessageSchema, OutboxService } from '@oppenheimer/backend-ddd';
import { DataSource } from 'typeorm';
import { QueueModule } from '../queue/queue.module';
import { OutboxRelayService } from './infrastructure/outbox-relay.adapter';

/**
 * Transactional outbox wiring. Global because every repository stages its
 * aggregate's domain events through `OutboxService` — inside the same TypeORM
 * transaction as the aggregate write — instead of emitting them directly.
 */
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([OutboxMessageSchema]), QueueModule],
  providers: [
    {
      provide: OutboxService,
      useFactory: (dataSource: DataSource) => new OutboxService(dataSource),
      inject: [DataSource],
    },
    OutboxRelayService,
  ],
  exports: [OutboxService],
})
export class OutboxModule {}
