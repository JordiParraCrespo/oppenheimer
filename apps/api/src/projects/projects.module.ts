import { Module, type Provider, type Type } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthzModule as AuthzKernelModule } from '@oppenheimer/backend-authz';
import { GithubModule } from '../github/github.module';
import { HostsModule } from '../hosts/hosts.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { UsersModule } from '../users/user.module';
import { OrganizationCreatedDomainEventHandler } from './application/event-handlers/organization-created.domain-event-handler';
import { PersonalWorkspaceProvisionedDomainEventHandler } from './application/event-handlers/personal-workspace-provisioned.domain-event-handler';
import { ProjectAccountErasure } from './application/project-account-erasure.resolver';
import { ProjectLookupResolver } from './application/project-lookup.resolver';
import { ProjectSettingsResolver } from './application/project-settings.resolver';
import type { ProjectUsagePort } from './application/project-usage.port';
import { ProjectUsageRegistry } from './application/project-usage.registry';
import { ArchiveProjectCommandHandler } from './commands/archive-project/archive-project.command-handler';
import { ArchiveProjectHttpController } from './commands/archive-project/archive-project.http.controller';
import { CreateProjectCommandHandler } from './commands/create-project/create-project.command-handler';
import { CreateProjectHttpController } from './commands/create-project/create-project.http.controller';
import { UpdateProjectCommandHandler } from './commands/update-project/update-project.command-handler';
import { UpdateProjectHttpController } from './commands/update-project/update-project.http.controller';
import { ProjectOrmEntity } from './database/project.orm-entity';
import { ProjectRepository } from './database/project.repository';
import { ProjectRepositoryOrmEntity } from './database/project-repository.orm-entity';
import { ProjectMapper } from './project.mapper';
import { PROJECT_LOOKUP, PROJECT_REPOSITORY } from './projects.di-tokens';
import { ProjectResource } from './projects.resource';
import { FindProjectHttpController } from './queries/find-project/find-project.http.controller';
import { FindProjectQueryHandler } from './queries/find-project/find-project.query-handler';
import { FindProjectsHttpController } from './queries/find-projects/find-projects.http.controller';
import { FindProjectsQueryHandler } from './queries/find-projects/find-projects.query-handler';

// Static routes before parameterized ones, so `GET /projects` is not shadowed by
// `GET /projects/:id`.
const httpControllers = [
  FindProjectsHttpController,
  FindProjectHttpController,
  CreateProjectHttpController,
  UpdateProjectHttpController,
  ArchiveProjectHttpController,
];

const commandHandlers: Provider[] = [
  CreateProjectCommandHandler,
  UpdateProjectCommandHandler,
  ArchiveProjectCommandHandler,
];
const queryHandlers: Provider[] = [FindProjectsQueryHandler, FindProjectQueryHandler];
const mappers: Provider[] = [ProjectMapper];
const repositories: Provider[] = [{ provide: PROJECT_REPOSITORY, useClass: ProjectRepository }];

@Module({
  imports: [
    CqrsModule,
    // What a project's repositories are called, and whether the workspace still
    // reaches them; and whether a default host is one the caller can use.
    GithubModule,
    HostsModule,
    // Which workspace an account owns, for deleting it.
    OrganizationsModule,
    TypeOrmModule.forFeature([ProjectOrmEntity, ProjectRepositoryOrmEntity]),
    AuthzKernelModule.forFeature([ProjectResource]),
  ],
  controllers: [...httpControllers],
  providers: [
    ...commandHandlers,
    ...queryHandlers,
    ...mappers,
    ...repositories,
    ProjectUsageRegistry,
    ProjectSettingsResolver,
    PersonalWorkspaceProvisionedDomainEventHandler,
    OrganizationCreatedDomainEventHandler,
    { provide: PROJECT_LOOKUP, useClass: ProjectLookupResolver },
    ...UsersModule.contributeAccountErasure([ProjectAccountErasure]),
  ],
  // The repository stays inside, so no consumer reads rows past the scoped
  // lookup. `ProjectUsageRegistry` is a class, not a token, because it is a
  // kernel-style registry: the one thing another module reaches across to
  // contribute the answer this module cannot give itself.
  exports: [PROJECT_LOOKUP, ProjectUsageRegistry],
})
export class ProjectsModule {
  /**
   * The providers a module adds to contribute what a project is still used for:
   *
   * ```ts
   * providers: [...ProjectsModule.contributeUsage([SessionProjectUsage])]
   * ```
   *
   * They go in the contributing module's `providers`, so the implementation is built in
   * the injector that owns the work and injects its repository ports without publishing
   * them; only the registry is reached across. Nest constructs every declared provider,
   * so the factory runs although nothing injects it, and a module never imported
   * contributes nothing.
   */
  static contributeUsage(usages: Type<ProjectUsagePort>[]): Provider[] {
    return [
      ...usages,
      {
        // Unique per call, so two contributions in one module cannot overwrite
        // one another.
        provide: Symbol('PROJECT_USAGE_CONTRIBUTION'),
        inject: [ProjectUsageRegistry, ...usages],
        useFactory: (registry: ProjectUsageRegistry, ...contributed: ProjectUsagePort[]) => {
          registry.registerAll(contributed);
          return contributed;
        },
      },
    ];
  }
}
