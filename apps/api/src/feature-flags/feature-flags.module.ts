import { Global, Module, type Provider } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FlagConfigurationChangedDomainEventHandler } from './application/event-handlers/flag-configuration-changed.domain-event-handler';
import { FlagSnapshotResolver } from './application/flag-snapshot.resolver';
import { CreateFlagSegmentCommandHandler } from './commands/create-flag-segment/create-flag-segment.command-handler';
import { CreateFlagSegmentHttpController } from './commands/create-flag-segment/create-flag-segment.http.controller';
import { DeleteFlagSegmentCommandHandler } from './commands/delete-flag-segment/delete-flag-segment.command-handler';
import { DeleteFlagSegmentHttpController } from './commands/delete-flag-segment/delete-flag-segment.http.controller';
import { ToggleFeatureFlagCommandHandler } from './commands/toggle-feature-flag/toggle-feature-flag.command-handler';
import { ToggleFeatureFlagHttpController } from './commands/toggle-feature-flag/toggle-feature-flag.http.controller';
import { UpdateFeatureFlagCommandHandler } from './commands/update-feature-flag/update-feature-flag.command-handler';
import { UpdateFeatureFlagHttpController } from './commands/update-feature-flag/update-feature-flag.http.controller';
import { UpdateFlagSegmentCommandHandler } from './commands/update-flag-segment/update-flag-segment.command-handler';
import { UpdateFlagSegmentHttpController } from './commands/update-flag-segment/update-flag-segment.http.controller';
import { FeatureFlagOrmEntity } from './database/feature-flag.orm-entity';
import { FeatureFlagRepository } from './database/feature-flag.repository';
import { FlagChangeOrmEntity } from './database/flag-change.orm-entity';
import { FlagChangeRepository } from './database/flag-change.repository';
import { FlagSegmentOrmEntity } from './database/flag-segment.orm-entity';
import { FlagSegmentRepository } from './database/flag-segment.repository';
import { FeatureFlagMapper } from './feature-flag.mapper';
import {
  FEATURE_FLAG_REPOSITORY,
  FLAG_CHANGE_REPOSITORY,
  FLAG_EVALUATOR,
  FLAG_SEGMENT_REPOSITORY,
  FLAG_SNAPSHOT,
} from './feature-flags.di-tokens';
import { FlagSegmentMapper } from './flag-segment.mapper';
import { FeatureFlagGuard } from './guards/feature-flag.guard';
import { EvaluateFeatureFlagHttpController } from './queries/evaluate-feature-flag/evaluate-feature-flag.http.controller';
import { EvaluateFeatureFlagQueryHandler } from './queries/evaluate-feature-flag/evaluate-feature-flag.query-handler';
import { FindFeatureFlagHttpController } from './queries/find-feature-flag/find-feature-flag.http.controller';
import { FindFeatureFlagQueryHandler } from './queries/find-feature-flag/find-feature-flag.query-handler';
import { FindFeatureFlagsHttpController } from './queries/find-feature-flags/find-feature-flags.http.controller';
import { FindFeatureFlagsQueryHandler } from './queries/find-feature-flags/find-feature-flags.query-handler';
import { FindFlagChangesHttpController } from './queries/find-flag-changes/find-flag-changes.http.controller';
import { FindFlagChangesQueryHandler } from './queries/find-flag-changes/find-flag-changes.query-handler';
import { FindFlagSegmentsHttpController } from './queries/find-flag-segments/find-flag-segments.http.controller';
import { FindFlagSegmentsQueryHandler } from './queries/find-flag-segments/find-flag-segments.query-handler';
import { GetClientFeatureFlagsHttpController } from './queries/get-client-feature-flags/get-client-feature-flags.http.controller';
import { GetClientFeatureFlagsQueryHandler } from './queries/get-client-feature-flags/get-client-feature-flags.query-handler';

// Static sub-routes (`changes`, `segments`, `admin`) before the parameterized
// ones beneath them.
const httpControllers = [
  GetClientFeatureFlagsHttpController,
  FindFlagChangesHttpController,
  FindFlagSegmentsHttpController,
  CreateFlagSegmentHttpController,
  UpdateFlagSegmentHttpController,
  DeleteFlagSegmentHttpController,
  FindFeatureFlagsHttpController,
  EvaluateFeatureFlagHttpController,
  FindFeatureFlagHttpController,
  UpdateFeatureFlagHttpController,
  ToggleFeatureFlagHttpController,
];

const commandHandlers: Provider[] = [
  UpdateFeatureFlagCommandHandler,
  ToggleFeatureFlagCommandHandler,
  CreateFlagSegmentCommandHandler,
  UpdateFlagSegmentCommandHandler,
  DeleteFlagSegmentCommandHandler,
];

const queryHandlers: Provider[] = [
  GetClientFeatureFlagsQueryHandler,
  FindFeatureFlagsQueryHandler,
  FindFeatureFlagQueryHandler,
  EvaluateFeatureFlagQueryHandler,
  FindFlagChangesQueryHandler,
  FindFlagSegmentsQueryHandler,
];

const eventHandlers: Provider[] = [FlagConfigurationChangedDomainEventHandler];

const repositories: Provider[] = [
  { provide: FEATURE_FLAG_REPOSITORY, useClass: FeatureFlagRepository },
  { provide: FLAG_SEGMENT_REPOSITORY, useClass: FlagSegmentRepository },
  { provide: FLAG_CHANGE_REPOSITORY, useClass: FlagChangeRepository },
];

/**
 * Feature flags: the catalog's targeting on this deployment, the segments it
 * targets, the audit trail, and the in-process evaluator everything else asks.
 *
 * `@Global` for the same reason `RolesModule` is: `@RequireFlag` puts
 * `FeatureFlagGuard` on routes in any module, and Nest instantiates a guard in
 * the injector of the module that uses it — so `FLAG_EVALUATOR` has to be
 * resolvable app-wide. The evaluator is exported as a token; nothing outside
 * names the snapshot class behind it.
 */
@Global()
@Module({
  imports: [
    CqrsModule,
    TypeOrmModule.forFeature([FeatureFlagOrmEntity, FlagSegmentOrmEntity, FlagChangeOrmEntity]),
  ],
  controllers: [...httpControllers],
  providers: [
    ...commandHandlers,
    ...queryHandlers,
    ...eventHandlers,
    ...repositories,
    FeatureFlagMapper,
    FlagSegmentMapper,
    FlagSnapshotResolver,
    // One instance behind both: the published evaluator, and the snapshot
    // controls only this module's change handler uses.
    { provide: FLAG_EVALUATOR, useExisting: FlagSnapshotResolver },
    { provide: FLAG_SNAPSHOT, useExisting: FlagSnapshotResolver },
    FeatureFlagGuard,
  ],
  exports: [FLAG_EVALUATOR, FeatureFlagGuard],
})
export class FeatureFlagsModule {}
