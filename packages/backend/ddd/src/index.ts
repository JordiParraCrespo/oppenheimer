export { AggregateRoot } from './aggregate-root.base';
export {
  CommandBase,
  type CommandMetadata,
  type CommandProps,
} from './command.base';
export {
  DomainEvent,
  type DomainEventMetadata,
  type DomainEventProps,
} from './domain-event.base';
export {
  type AggregateID,
  type BaseEntityProps,
  type CreateEntityProps,
  Entity,
} from './entity.base';
export {
  ArgumentInvalidException,
  ArgumentNotProvidedException,
  ArgumentOutOfRangeException,
  ConflictException,
  type ErrorDefinition,
  ExceptionBase,
  NotFoundException,
} from './exceptions';
export { Guard } from './guard';
export type { Mapper } from './mapper.interface';
export {
  type ClaimOptions,
  type EventfulAggregate,
  OutboxService,
  type OutboxServiceOptions,
  type StageJobParams,
} from './outbox/outbox.service';
export {
  OUTBOX_TABLE,
  type OutboxChannel,
  type OutboxMessageRecord,
  OutboxMessageSchema,
  type OutboxMessageStatus,
} from './outbox/outbox-message';
export {
  type OutboxPublisher,
  OutboxRelay,
  type OutboxRelayOptions,
} from './outbox/outbox-relay';
export { QueryBase } from './query.base';
export {
  type OrderBy,
  Paginated,
  type PaginatedQueryParams,
  type RepositoryPort,
} from './repository.port';
export { RequestContextService } from './request-context.service';
export { convertPropsToObject } from './utils';
export {
  type DomainPrimitive,
  type Primitives,
  ValueObject,
} from './value-object.base';
