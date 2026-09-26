import { Module, type Provider, type Type } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthzModule as AuthzKernelModule } from '@oppenheimer/backend-authz';
import { GithubModule } from '../github/github.module';
import { HostsModule } from '../hosts/hosts.module';
import { ProjectLookupResolver } from './application/project-lookup.resolver';
import { ProjectRepositoriesResolver } from './application/project-repositories.resolver';
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
  CreateProjectHttpController,
  FindProjectHttpController,
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
    TypeOrmModule.forFeature([ProjectOrmEntity, ProjectRepositoryOrmEntity]),
    AuthzKernelModule.forFeature([ProjectResource]),
    // What a project made on the console names: repositories an installation
    // covers, and a host the workspace holds. Both are confirmed through the
    // ports those modules publish, never read from their tables.
    GithubModule,
    HostsModule,
  ],
  controllers: [...httpControllers],
  providers: [
    ...commandHandlers,
    ...queryHandlers,
    ...mappers,
    ...repositories,
    ProjectUsageRegistry,
    ProjectRepositoriesResolver,
    { provide: PROJECT_LOOKUP, useClass: ProjectLookupResolver },
  ],
  // `PROJECT_LOOKUP` is the module's whole published surface: what owns sessions
  // injects it to resolve — and, on a repository's first session, create — a
  // project. The repository stays inside so no consumer can read rows past the
  // scoped lookup. `ProjectUsageRegistry` is the other half of that surface, and it
  // is a class rather than a token because it is a kernel-style registry: the one
  // thing another module reaches across to contribute the answer this module cannot
  // give itself — whether archiving a project would strand work.
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
   * They go in the **contributing module's** `providers`, not in an imported module
   * of this one's, and that placement is the whole point: the implementation is
   * constructed in the injector of the module that owns the work, so it injects that
   * module's own repository ports without anything having to be published
   * application-wide. The only thing reached across is the registry.
   *
   * Registration happens when that module is instantiated — Nest constructs every
   * provider a module declares, so the factory below runs although nothing injects
   * it — which means a module that is never imported contributes nothing, and the
   * registry describes the application that is actually running.
   */
  static contributeUsage(usages: Type<ProjectUsagePort>[]): Provider[] {
    return [
      ...usages,
      {
        // Constructing this provider *is* the registration: the implementations are
        // instantiated as its dependencies and handed to the registry. The token is
        // unique per call so two contributions in one module cannot overwrite one
        // another.
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
