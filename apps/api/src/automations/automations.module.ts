import { Module, type Provider } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthzModule as AuthzKernelModule } from '@oppenheimer/backend-authz';
import { GithubModule } from '../github/github.module';
import { HostsModule } from '../hosts/hosts.module';
import { InboundEventsModule } from '../inbound-events/inbound-events.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { ProjectsModule } from '../projects/projects.module';
import { QueueModule } from '../queue/queue.module';
import { UsersModule } from '../users/user.module';
import { AutomationAccountErasure } from './application/automation-account-erasure.resolver';
import { AutomationLimitsResolver } from './application/automation-limits.resolver';
import { AutomationPlanFactory } from './application/automation-plan.factory';
import { ExternalEventReceivedDomainEventHandler } from './application/event-handlers/external-event-received.domain-event-handler';
import { HostUnpairedPausesAutomationsDomainEventHandler } from './application/event-handlers/host-unpaired.domain-event-handler';
import { ProjectArchivedPausesAutomationsDomainEventHandler } from './application/event-handlers/project-archived.domain-event-handler';
import { RunSessionChangedDomainEventHandler } from './application/event-handlers/run-session-changed.domain-event-handler';
import { OwnerScopeResolver } from './application/owner-scope.resolver';
import { RunDispatchResolver } from './application/run-dispatch.resolver';
import { AutomationMapper } from './automation.mapper';
import { AutomationRunMapper } from './automation-run.mapper';
import {
  AUTOMATION_REPOSITORY,
  AUTOMATION_RUN_REPOSITORY,
  AUTOMATION_SETTINGS_REPOSITORY,
} from './automations.di-tokens';
import { AutomationResource } from './automations.resource';
import { CreateAutomationCommandHandler } from './commands/create-automation/create-automation.command-handler';
import { CreateAutomationHttpController } from './commands/create-automation/create-automation.http.controller';
import { DeleteAutomationCommandHandler } from './commands/delete-automation/delete-automation.command-handler';
import { DeleteAutomationHttpController } from './commands/delete-automation/delete-automation.http.controller';
import { DispatchAutomationRunCommandHandler } from './commands/dispatch-automation-run/dispatch-automation-run.command-handler';
import { DuplicateAutomationCommandHandler } from './commands/duplicate-automation/duplicate-automation.command-handler';
import { DuplicateAutomationHttpController } from './commands/duplicate-automation/duplicate-automation.http.controller';
import { EnforceRunLimitsCommandHandler } from './commands/enforce-run-limits/enforce-run-limits.command-handler';
import { FireDueSchedulesCommandHandler } from './commands/fire-due-schedules/fire-due-schedules.command-handler';
import { FireEventTriggersCommandHandler } from './commands/fire-event-triggers/fire-event-triggers.command-handler';
import { PauseAutomationCommandHandler } from './commands/pause-automation/pause-automation.command-handler';
import { PauseAutomationHttpController } from './commands/pause-automation/pause-automation.http.controller';
import { ResumeAutomationCommandHandler } from './commands/resume-automation/resume-automation.command-handler';
import { ResumeAutomationHttpController } from './commands/resume-automation/resume-automation.http.controller';
import { RunAutomationCommandHandler } from './commands/run-automation/run-automation.command-handler';
import { RunAutomationHttpController } from './commands/run-automation/run-automation.http.controller';
import { UpdateAutomationCommandHandler } from './commands/update-automation/update-automation.command-handler';
import { UpdateAutomationHttpController } from './commands/update-automation/update-automation.http.controller';
import { UpdateAutomationSettingsCommandHandler } from './commands/update-automation-settings/update-automation-settings.command-handler';
import { UpdateAutomationSettingsHttpController } from './commands/update-automation-settings/update-automation-settings.http.controller';
import { AutomationOrmEntity } from './database/automation.orm-entity';
import { AutomationRepository } from './database/automation.repository';
import { AutomationRevisionOrmEntity } from './database/automation-revision.orm-entity';
import { AutomationRunOrmEntity } from './database/automation-run.orm-entity';
import { AutomationRunRepository } from './database/automation-run.repository';
import { AutomationSettingsOrmEntity } from './database/automation-settings.orm-entity';
import { AutomationSettingsRepository } from './database/automation-settings.repository';
import { AutomationTriggerOrmEntity } from './database/automation-trigger.orm-entity';
import { AutomationTriggerSubjectOrmEntity } from './database/automation-trigger-subject.orm-entity';
import { AutomationRetentionProcessor } from './infrastructure/automation-retention.processor';
import { AutomationRunsProcessor } from './infrastructure/automation-runs.processor';
import { AutomationSchedulesProcessor } from './infrastructure/automation-schedules.processor';
import { FindAutomationHttpController } from './queries/find-automation/find-automation.http.controller';
import { FindAutomationQueryHandler } from './queries/find-automation/find-automation.query-handler';
import { FindAutomationRunHttpController } from './queries/find-automation-run/find-automation-run.http.controller';
import { FindAutomationRunQueryHandler } from './queries/find-automation-run/find-automation-run.query-handler';
import { FindAutomationRunsHttpController } from './queries/find-automation-runs/find-automation-runs.http.controller';
import { FindAutomationRunsQueryHandler } from './queries/find-automation-runs/find-automation-runs.query-handler';
import { FindAutomationSettingsHttpController } from './queries/find-automation-settings/find-automation-settings.http.controller';
import { FindAutomationSettingsQueryHandler } from './queries/find-automation-settings/find-automation-settings.query-handler';
import { FindAutomationsHttpController } from './queries/find-automations/find-automations.http.controller';
import { FindAutomationsQueryHandler } from './queries/find-automations/find-automations.query-handler';
import { FindRunHistoryHttpController } from './queries/find-run-history/find-run-history.http.controller';
import { FindRunHistoryQueryHandler } from './queries/find-run-history/find-run-history.query-handler';
import { PreviewTriggerHttpController } from './queries/preview-trigger/preview-trigger.http.controller';
import { PreviewTriggerQueryHandler } from './queries/preview-trigger/preview-trigger.query-handler';

// Static routes before parameterized ones: `automation-runs/history` before
// `automation-runs/:id`.
const httpControllers = [
  FindAutomationsHttpController,
  CreateAutomationHttpController,
  PreviewTriggerHttpController,
  FindAutomationHttpController,
  UpdateAutomationHttpController,
  DeleteAutomationHttpController,
  PauseAutomationHttpController,
  ResumeAutomationHttpController,
  DuplicateAutomationHttpController,
  RunAutomationHttpController,
  FindAutomationRunsHttpController,
  FindRunHistoryHttpController,
  FindAutomationRunHttpController,
  FindAutomationSettingsHttpController,
  UpdateAutomationSettingsHttpController,
];

const commandHandlers: Provider[] = [
  CreateAutomationCommandHandler,
  UpdateAutomationCommandHandler,
  PauseAutomationCommandHandler,
  ResumeAutomationCommandHandler,
  DuplicateAutomationCommandHandler,
  DeleteAutomationCommandHandler,
  RunAutomationCommandHandler,
  UpdateAutomationSettingsCommandHandler,
  FireEventTriggersCommandHandler,
  FireDueSchedulesCommandHandler,
  EnforceRunLimitsCommandHandler,
  DispatchAutomationRunCommandHandler,
];

const queryHandlers: Provider[] = [
  FindAutomationsQueryHandler,
  FindAutomationQueryHandler,
  FindAutomationRunsQueryHandler,
  FindRunHistoryQueryHandler,
  FindAutomationRunQueryHandler,
  PreviewTriggerQueryHandler,
  FindAutomationSettingsQueryHandler,
];

/**
 * Automations (`product/versions/mvp/16-automations-architecture.md`): saved
 * prompts, their triggers, the scheduler, the matcher over the inbound-events
 * hub, the guards, and the dispatcher that starts each run as a session of
 * its owner. Execution is the sessions module's; this module records why a run
 * happened and reads how it went.
 */
@Module({
  imports: [
    CqrsModule,
    TypeOrmModule.forFeature([
      AutomationOrmEntity,
      AutomationRevisionOrmEntity,
      AutomationTriggerOrmEntity,
      AutomationTriggerSubjectOrmEntity,
      AutomationRunOrmEntity,
      AutomationSettingsOrmEntity,
    ]),
    AuthzKernelModule.forFeature([AutomationResource]),
    // The automation-runs, -schedules and -retention queues.
    QueueModule,
    // What an automation names, confirmed through the owners' ports: a project,
    // a host, repositories; the workspace membership a run's owner must keep;
    // the hub's events.
    ProjectsModule,
    HostsModule,
    GithubModule,
    OrganizationsModule,
    InboundEventsModule,
    // Sessions are started and stopped by dispatching their own commands on
    // the bus (`CreateSessionCommand`, `StopSessionCommand`); nothing of the
    // sessions module is injected here, so it is not imported.
  ],
  controllers: [...httpControllers],
  providers: [
    ...commandHandlers,
    ...queryHandlers,
    AutomationMapper,
    AutomationRunMapper,
    AutomationPlanFactory,
    AutomationLimitsResolver,
    OwnerScopeResolver,
    RunDispatchResolver,
    ExternalEventReceivedDomainEventHandler,
    HostUnpairedPausesAutomationsDomainEventHandler,
    ProjectArchivedPausesAutomationsDomainEventHandler,
    RunSessionChangedDomainEventHandler,
    AutomationRunsProcessor,
    AutomationSchedulesProcessor,
    AutomationRetentionProcessor,
    ...UsersModule.contributeAccountErasure([AutomationAccountErasure]),
    { provide: AUTOMATION_REPOSITORY, useClass: AutomationRepository },
    { provide: AUTOMATION_RUN_REPOSITORY, useClass: AutomationRunRepository },
    { provide: AUTOMATION_SETTINGS_REPOSITORY, useClass: AutomationSettingsRepository },
  ],
})
export class AutomationsModule {}
