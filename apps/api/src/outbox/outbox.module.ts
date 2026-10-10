import { Global, Logger, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { createMetricsProvider } from '@oppenheimer/backend-core';
import { OutboxMessageSchema, OutboxService } from '@oppenheimer/backend-ddd';
import { DataSource } from 'typeorm';
import { QueueModule } from '../queue/queue.module';
import { BacklogMetrics, BacklogMetricsSampler } from './infrastructure/backlog-metrics.adapter';
import { OutboxRelayService } from './infrastructure/outbox-relay.adapter';
import { OutboxRetentionProcessor } from './infrastructure/outbox-retention.processor';

/**
 * Global because every repository stages its
 * aggregate's domain events through `OutboxService` — inside the same TypeORM
 * transaction as the aggregate write — instead of emitting them directly.
 */
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([OutboxMessageSchema]), QueueModule],
  providers: [
    {
      provide: OutboxService,
      // A failed post-commit drain reaches no caller; the log is where it shows.
      useFactory: (dataSource: DataSource) =>
        new OutboxService(dataSource, { logger: new Logger(OutboxService.name) }),
      inject: [DataSource],
    },
    OutboxRelayService,
    OutboxRetentionProcessor,
    // What the API owes, as gauges: here because the outbox is what feeds the
    // queues, and this module already holds a handle on each of them.
    ...createMetricsProvider(BacklogMetrics),
    BacklogMetricsSampler,
  ],
  exports: [OutboxService],
})
export class OutboxModule {}
