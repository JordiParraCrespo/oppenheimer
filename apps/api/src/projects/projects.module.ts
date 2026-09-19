import { Module, type Provider } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthzModule as AuthzKernelModule } from '@oppenheimer/backend-authz';
import { ProjectLookupResolver } from './application/project-lookup.resolver';
import { ProjectUsageResolver } from './application/project-usage.resolver';
import { ArchiveProjectCommandHandler } from './commands/archive-project/archive-project.command-handler';
import { ArchiveProjectHttpController } from './commands/archive-project/archive-project.http.controller';
import { UpdateProjectCommandHandler } from './commands/update-project/update-project.command-handler';
import { UpdateProjectHttpController } from './commands/update-project/update-project.http.controller';
import { ProjectOrmEntity } from './database/project.orm-entity';
import { ProjectRepository } from './database/project.repository';
import { ProjectMapper } from './project.mapper';
import { PROJECT_LOOKUP, PROJECT_REPOSITORY, PROJECT_USAGE_REGISTRAR } from './projects.di-tokens';
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
  UpdateProjectHttpController,
  ArchiveProjectHttpController,
];

const commandHandlers: Provider[] = [UpdateProjectCommandHandler, ArchiveProjectCommandHandler];
const queryHandlers: Provider[] = [FindProjectsQueryHandler, FindProjectQueryHandler];
const mappers: Provider[] = [ProjectMapper];
const repositories: Provider[] = [{ provide: PROJECT_REPOSITORY, useClass: ProjectRepository }];

@Module({
  imports: [
    CqrsModule,
    TypeOrmModule.forFeature([ProjectOrmEntity]),
    AuthzKernelModule.forFeature([ProjectResource]),
  ],
  controllers: [...httpControllers],
  providers: [
    ...commandHandlers,
    ...queryHandlers,
    ...mappers,
    ...repositories,
    ProjectUsageResolver,
    { provide: PROJECT_USAGE_REGISTRAR, useExisting: ProjectUsageResolver },
    { provide: PROJECT_LOOKUP, useClass: ProjectLookupResolver },
  ],
  // `PROJECT_LOOKUP` is the module's whole published surface: what owns sessions
  // injects it to resolve — and, on a repository's first session, create — a
  // project. The repository stays inside so no consumer can read rows past the
  // scoped lookup. `PROJECT_USAGE_REGISTRAR` is the other half of that surface:
  // where the module that owns sessions registers the one thing this module cannot
  // answer for itself — whether archiving a project would strand work.
  exports: [PROJECT_LOOKUP, PROJECT_USAGE_REGISTRAR],
})
export class ProjectsModule {}
