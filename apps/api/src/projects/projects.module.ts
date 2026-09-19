import { Module, type Provider } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthzModule as AuthzKernelModule } from '@oppenheimer/backend-authz';
import { ProjectLookupResolver } from './application/project-lookup.resolver';
import type { ProjectUsagePort } from './application/project-usage.port';
import { ArchiveProjectCommandHandler } from './commands/archive-project/archive-project.command-handler';
import { ArchiveProjectHttpController } from './commands/archive-project/archive-project.http.controller';
import { UpdateProjectCommandHandler } from './commands/update-project/update-project.command-handler';
import { UpdateProjectHttpController } from './commands/update-project/update-project.http.controller';
import { ProjectOrmEntity } from './database/project.orm-entity';
import { ProjectRepository } from './database/project.repository';
import { ProjectMapper } from './project.mapper';
import { PROJECT_LOOKUP, PROJECT_REPOSITORY, PROJECT_USAGE } from './projects.di-tokens';
import { ProjectResource } from './projects.resource';
import { FindProjectHttpController } from './queries/find-project/find-project.http.controller';
import { FindProjectQueryHandler } from './queries/find-project/find-project.query-handler';
import { FindProjectsHttpController } from './queries/find-projects/find-projects.http.controller';
import { FindProjectsQueryHandler } from './queries/find-projects/find-projects.query-handler';

// Static routes before parameterized ones, so `GET /projects` is not shadowed
// by `GET /projects/:id`.
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

/**
 * Nothing reports open sessions yet, so nothing blocks archiving.
 *
 * The binding is what the module that owns sessions replaces; keeping the port
 * and a default answer here means `archive-project` is written once, against the
 * question it actually asks, instead of growing the check later.
 */
const NO_OPEN_SESSIONS: ProjectUsagePort = { hasOpenSessions: async () => false };

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
    { provide: PROJECT_LOOKUP, useClass: ProjectLookupResolver },
    { provide: PROJECT_USAGE, useValue: NO_OPEN_SESSIONS },
  ],
  // `PROJECT_LOOKUP` is the surface the module that owns sessions injects to
  // resolve — and, on a repository's first session, create — a project.
  exports: [PROJECT_REPOSITORY, PROJECT_LOOKUP],
})
export class ProjectsModule {}
