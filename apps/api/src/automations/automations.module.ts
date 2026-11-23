import { Module, type NestModule, type Provider, type Type } from '@nestjs/common';
import { ApplicationConfig, HttpAdapterHost } from '@nestjs/core';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthzModule as AuthzKernelModule } from '@oppenheimer/backend-authz';
import { configKeySealer } from '@oppenheimer/backend-core';
import { WEBHOOK_BODY_MAX_BYTES } from '@oppenheimer/shared/automations';
import { botsProviderKeyOf } from '../config/bots.config';
import { mountRawBodyParser } from '../config/raw-body-parser';
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
import type { AutomationRunTargetPort } from './application/automation-run-target.port';
import { AutomationRunTargetRegistry } from './application/automation-run-target.registry';
import { BotRoutineResolver } from './application/bot-routine.resolver';
import { BranchSessionBotsResolver } from './application/branch-session-bots.resolver';
import { ExternalEventReceivedDomainEventHandler } from './application/event-handlers/external-event-received.domain-event-handler';
import { HostUnpairedPausesAutomationsDomainEventHandler } from './application/event-handlers/host-unpaired.domain-event-handler';
import { ProjectArchivedPausesAutomationsDomainEventHandler } from './application/event-handlers/project-archived.domain-event-handler';
import { OwnerScopeResolver } from './application/owner-scope.resolver';
import { RoutineWebhookResolver } from './application/routine-webhook.resolver';
import { RunDispatchResolver } from './application/run-dispatch.resolver';
import { AutomationMapper } from './automation.mapper';
import { AutomationRunMapper } from './automation-run.mapper';
import {
  AUTOMATION_REPOSITORY,
  AUTOMATION_RUN_REPOSITORY,
  AUTOMATION_SETTINGS_REPOSITORY,
  AUTOMATION_WEBHOOK_REPOSITORY,
  WEBHOOK_SECRET_SEALER,
} from './automations.di-tokens';
import { AutomationResource } from './automations.resource';
import { CreateAutomationCommandHandler } from './commands/create-automation/create-automation.command-handler';
import { CreateAutomationHttpController } from './commands/create-automation/create-automation.http.controller';
import { DeleteAutomationCommandHandler } from './commands/delete-automation/delete-automation.command-handler';
import { DeleteAutomationHttpController } from './commands/delete-automation/delete-automation.http.controller';
import { DeleteBotRoutineCommandHandler } from './commands/delete-bot-routine/delete-bot-routine.command-handler';
// Static routes before parameterized ones: `automation-runs/history` before
// `automation-runs/:id`.
import { DeleteBotRoutineHttpController } from './commands/delete-bot-routine/delete-bot-routine.http.controller';
import { DispatchAutomationRunCommandHandler } from './commands/dispatch-automation-run/dispatch-automation-run.command-handler';
import { DuplicateAutomationCommandHandler } from './commands/duplicate-automation/duplicate-automation.command-handler';
import { DuplicateAutomationHttpController } from './commands/duplicate-automation/duplicate-automation.http.controller';
import { EnforceRunLimitsCommandHandler } from './commands/enforce-run-limits/enforce-run-limits.command-handler';
import { FireDueSchedulesCommandHandler } from './commands/fire-due-schedules/fire-due-schedules.command-handler';
import { FireEventTriggersCommandHandler } from './commands/fire-event-triggers/fire-event-triggers.command-handler';
import { IssueRoutineWebhookCommandHandler } from './commands/issue-routine-webhook/issue-routine-webhook.command-handler';
import { IssueRoutineWebhookHttpController } from './commands/issue-routine-webhook/issue-routine-webhook.http.controller';
import { PauseAutomationCommandHandler } from './commands/pause-automation/pause-automation.command-handler';
import { PauseAutomationHttpController } from './commands/pause-automation/pause-automation.http.controller';
import { ReceiveRoutineWebhookCommandHandler } from './commands/receive-routine-webhook/receive-routine-webhook.command-handler';
import { ReceiveRoutineWebhookHttpController } from './commands/receive-routine-webhook/receive-routine-webhook.http.controller';
import { ResumeAutomationCommandHandler } from './commands/resume-automation/resume-automation.command-handler';
import { ResumeAutomationHttpController } from './commands/resume-automation/resume-automation.http.controller';
import { RevokeRoutineWebhookCommandHandler } from './commands/revoke-routine-webhook/revoke-routine-webhook.command-handler';
import { RevokeRoutineWebhookHttpController } from './commands/revoke-routine-webhook/revoke-routine-webhook.http.controller';
import { RunAutomationCommandHandler } from './commands/run-automation/run-automation.command-handler';
import { RunAutomationHttpController } from './commands/run-automation/run-automation.http.controller';
import { RunBotRoutineCommandHandler } from './commands/run-bot-routine/run-bot-routine.command-handler';
import { RunBotRoutineHttpController } from './commands/run-bot-routine/run-bot-routine.http.controller';
import { SaveBotRoutineCommandHandler } from './commands/save-bot-routine/save-bot-routine.command-handler';
import { UpdateAutomationCommandHandler } from './commands/update-automation/update-automation.command-handler';
import { UpdateAutomationHttpController } from './commands/update-automation/update-automation.http.controller';
import { UpdateAutomationSettingsCommandHandler } from './commands/update-automation-settings/update-automation-settings.command-handler';
import { UpdateAutomationSettingsHttpController } from './commands/update-automation-settings/update-automation-settings.http.controller';
import { UpdateBotRoutineHttpController } from './commands/update-bot-routine/update-bot-routine.http.controller';
import { AutomationOrmEntity } from './database/automation.orm-entity';
import { AutomationRepository } from './database/automation.repository';
import { AutomationRevisionOrmEntity } from './database/automation-revision.orm-entity';
import { AutomationRunOrmEntity } from './database/automation-run.orm-entity';
import { AutomationRunRepository } from './database/automation-run.repository';
import { AutomationSettingsOrmEntity } from './database/automation-settings.orm-entity';
import { AutomationSettingsRepository } from './database/automation-settings.repository';
import { AutomationTriggerOrmEntity } from './database/automation-trigger.orm-entity';
import { AutomationTriggerSubjectOrmEntity } from './database/automation-trigger-subject.orm-entity';
import { AutomationWebhookOrmEntity } from './database/automation-webhook.orm-entity';
import { AutomationWebhookRepository } from './database/automation-webhook.repository';
import { AutomationRetentionProcessor } from './infrastructure/automation-retention.processor';
import { AutomationRunsProcessor } from './infrastructure/automation-runs.processor';
import { AutomationSchedulesProcessor } from './infrastructure/automation-schedules.processor';
import { SessionRunTarget } from './infrastructure/session-run-target.adapter';
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
import { FindBotRoutineRefQueryHandler } from './queries/find-bot-routine-ref/find-bot-routine-ref.query-handler';
import { FindBotRoutinesHttpController } from './queries/find-bot-routines/find-bot-routines.http.controller';
import { FindBotRoutinesQueryHandler } from './queries/find-bot-routines/find-bot-routines.query-handler';
import { FindRoutinesHttpController } from './queries/find-routines/find-routines.http.controller';
import { FindRoutinesQueryHandler } from './queries/find-routines/find-routines.query-handler';
import { FindRunHistoryHttpController } from './queries/find-run-history/find-run-history.http.controller';
import { FindRunHistoryQueryHandler } from './queries/find-run-history/find-run-history.query-handler';
import { FindWatchedSubjectsQueryHandler } from './queries/find-watched-subjects/find-watched-subjects.query-handler';
import { PreviewTriggerHttpController } from './queries/preview-trigger/preview-trigger.http.controller';
import { PreviewTriggerQueryHandler } from './queries/preview-trigger/preview-trigger.query-handler';

const httpControllers = [
  FindAutomationsHttpController,
  // Before `:id`, so `routines` is not read as an automation's id.
  FindRoutinesHttpController,
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
  FindBotRoutinesHttpController,
  UpdateBotRoutineHttpController,
  RunBotRoutineHttpController,
  DeleteBotRoutineHttpController,
  IssueRoutineWebhookHttpController,
  RevokeRoutineWebhookHttpController,
  ReceiveRoutineWebhookHttpController,
];

const commandHandlers: Provider[] = [
  RunBotRoutineCommandHandler,
  DeleteBotRoutineCommandHandler,
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
  SaveBotRoutineCommandHandler,
  IssueRoutineWebhookCommandHandler,
  RevokeRoutineWebhookCommandHandler,
  ReceiveRoutineWebhookCommandHandler,
];

const queryHandlers: Provider[] = [
  FindAutomationsQueryHandler,
  FindAutomationQueryHandler,
  FindAutomationRunsQueryHandler,
  FindRunHistoryQueryHandler,
  FindAutomationRunQueryHandler,
  PreviewTriggerQueryHandler,
  FindAutomationSettingsQueryHandler,
  FindBotRoutinesQueryHandler,
  FindBotRoutineRefQueryHandler,
  FindWatchedSubjectsQueryHandler,
  FindRoutinesQueryHandler,
];

/**
 * Automations: saved
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
      AutomationWebhookOrmEntity,
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
    BotRoutineResolver,
    RoutineWebhookResolver,
    AutomationLimitsResolver,
    BranchSessionBotsResolver,
    OwnerScopeResolver,
    RunDispatchResolver,
    AutomationRunTargetRegistry,
    ...runTargetProviders([SessionRunTarget]),
    ExternalEventReceivedDomainEventHandler,
    HostUnpairedPausesAutomationsDomainEventHandler,
    ProjectArchivedPausesAutomationsDomainEventHandler,
    AutomationRunsProcessor,
    AutomationSchedulesProcessor,
    AutomationRetentionProcessor,
    ...UsersModule.contributeAccountErasure([AutomationAccountErasure]),
    { provide: AUTOMATION_REPOSITORY, useClass: AutomationRepository },
    { provide: AUTOMATION_RUN_REPOSITORY, useClass: AutomationRunRepository },
    { provide: AUTOMATION_SETTINGS_REPOSITORY, useClass: AutomationSettingsRepository },
    { provide: AUTOMATION_WEBHOOK_REPOSITORY, useClass: AutomationWebhookRepository },
    // A routine runs on its bot's provider, whose keys are sealed under this
    // key: a deployment with routines has it, and a webhook's secret joins them.
    configKeySealer(WEBHOOK_SECRET_SEALER, {
      configKey: 'bots.providerKey',
      envName: 'BOTS_PROVIDER_KEY',
      keyOf: botsProviderKeyOf,
    }),
  ],
  // The run a session was started for, so the workspace feed can say that run
  // moved; the registry, for the targets other modules contribute.
  exports: [AUTOMATION_RUN_REPOSITORY, AutomationRunTargetRegistry],
})
export class AutomationsModule implements NestModule {
  constructor(
    private readonly adapterHost: HttpAdapterHost,
    private readonly appConfig: ApplicationConfig,
  ) {}

  /** A routine webhook's body as raw bytes, so a signature is checked over exactly what was sent. */
  configure(): void {
    mountRawBodyParser(
      this.adapterHost,
      this.appConfig,
      ReceiveRoutineWebhookHttpController,
      'receive',
      WEBHOOK_BODY_MAX_BYTES,
    );
  }

  /**
   * The providers a module adds to carry out runs of its own kind:
   *
   * ```ts
   * providers: [...AutomationsModule.contributeRunTargets([BotRoutineTarget])]
   * ```
   *
   * Constructed in the contributing module's injector, so the adapter injects
   * that module's own ports, as `InboundEventsModule.contributeSources` does;
   * the registry refuses a second adapter for a kind at boot.
   */
  static contributeRunTargets(targets: Type<AutomationRunTargetPort>[]): Provider[] {
    return runTargetProviders(targets);
  }
}

function runTargetProviders(targets: Type<AutomationRunTargetPort>[]): Provider[] {
  return targets.flatMap((target) => [
    target,
    {
      provide: Symbol.for(`AUTOMATION_RUN_TARGET:${target.name}`),
      inject: [AutomationRunTargetRegistry, target],
      useFactory: (registry: AutomationRunTargetRegistry, adapter: AutomationRunTargetPort) => {
        registry.registerAll([adapter]);
        return adapter;
      },
    },
  ]);
}
