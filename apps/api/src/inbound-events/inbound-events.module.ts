import { BullModule } from '@nestjs/bullmq';
import { Module, type Provider, type Type } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QUEUE_NAMES } from '@oppenheimer/shared';
import type { ExternalEventSourcePort } from './application/external-event-source.port';
import { ExternalEventSourceRegistry } from './application/external-event-source.registry';
import { InboundEventLookupResolver } from './application/inbound-event-lookup.resolver';
import { ProcessInboundDeliveryCommandHandler } from './commands/process-inbound-delivery/process-inbound-delivery.command-handler';
import { ReceiveInboundDeliveryCommandHandler } from './commands/receive-inbound-delivery/receive-inbound-delivery.command-handler';
import { InboundDeliveryOrmEntity } from './database/inbound-delivery.orm-entity';
import { InboundEventOrmEntity } from './database/inbound-event.orm-entity';
import { InboundEventRepository } from './database/inbound-event.repository';
import { InboundEventMapper } from './inbound-event.mapper';
import { INBOUND_EVENT_LOOKUP, INBOUND_EVENT_REPOSITORY } from './inbound-events.di-tokens';
import { InboundEventsProcessor } from './infrastructure/inbound-events.processor';

/**
 * The inbound-events hub (`product/versions/mvp/16-automations-architecture.md`
 * §Q6): provider-neutral storage, de-duplication, normalization and
 * publication of what external systems tell us.
 *
 * It imports no provider and no consumer. Providers (`github/`, later `slack/`)
 * contribute a source adapter and dispatch `ReceiveInboundDeliveryCommand` from
 * their own verified endpoint; consumers (`automations/`) listen for
 * `ExternalEventReceivedDomainEvent` and read through `INBOUND_EVENT_LOOKUP`.
 *
 * Nest modules are singletons, so every module that imports this one — each
 * provider, to contribute its adapter — shares the one registry.
 */
@Module({
  imports: [
    CqrsModule,
    TypeOrmModule.forFeature([InboundDeliveryOrmEntity, InboundEventOrmEntity]),
    BullModule.registerQueue({ name: QUEUE_NAMES.INBOUND_EVENTS }),
  ],
  providers: [
    ReceiveInboundDeliveryCommandHandler,
    ProcessInboundDeliveryCommandHandler,
    InboundEventMapper,
    ExternalEventSourceRegistry,
    InboundEventsProcessor,
    { provide: INBOUND_EVENT_REPOSITORY, useClass: InboundEventRepository },
    { provide: INBOUND_EVENT_LOOKUP, useClass: InboundEventLookupResolver },
  ],
  exports: [ExternalEventSourceRegistry, INBOUND_EVENT_LOOKUP],
})
export class InboundEventsModule {
  /**
   * The providers a module adds to feed the hub:
   *
   * ```ts
   * providers: [...InboundEventsModule.contributeSources([GithubEventSource])]
   * ```
   *
   * Constructed in the contributing module's injector, so the adapter injects
   * that module's own ports (the installation lookup) without publishing them;
   * the only thing reached across is the registry. Same pattern as
   * `ProjectsModule.contributeUsage`.
   *
   * Each adapter registers under a token named for it, so the injector shows
   * which sources the application has; the registry refuses a second adapter
   * for a source id at boot.
   */
  static contributeSources(sources: Type<ExternalEventSourcePort>[]): Provider[] {
    return sources.flatMap((source) => [
      source,
      {
        provide: Symbol.for(`EXTERNAL_EVENT_SOURCE:${source.name}`),
        inject: [ExternalEventSourceRegistry, source],
        useFactory: (registry: ExternalEventSourceRegistry, adapter: ExternalEventSourcePort) => {
          registry.registerAll([adapter]);
          return adapter;
        },
      },
    ]);
  }
}
