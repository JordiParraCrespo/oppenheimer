import { Module, type Provider } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthzModule as AuthzKernelModule } from '@oppenheimer/backend-authz';
import { ProjectsModule } from '../projects/projects.module';
import { TaskFilingResolver } from './application/task-filing.resolver';
import { CreateMilestoneCommandHandler } from './commands/create-milestone/create-milestone.command-handler';
import { CreateMilestoneHttpController } from './commands/create-milestone/create-milestone.http.controller';
import { CreateTaskCommandHandler } from './commands/create-task/create-task.command-handler';
import { CreateTaskHttpController } from './commands/create-task/create-task.http.controller';
import { DeleteMilestoneCommandHandler } from './commands/delete-milestone/delete-milestone.command-handler';
import { DeleteMilestoneHttpController } from './commands/delete-milestone/delete-milestone.http.controller';
import { DeleteTaskCommandHandler } from './commands/delete-task/delete-task.command-handler';
import { DeleteTaskHttpController } from './commands/delete-task/delete-task.http.controller';
import { LinkTaskSessionCommandHandler } from './commands/link-task-session/link-task-session.command-handler';
import { LinkTaskSessionHttpController } from './commands/link-task-session/link-task-session.http.controller';
import { MoveTaskCommandHandler } from './commands/move-task/move-task.command-handler';
import { MoveTaskHttpController } from './commands/move-task/move-task.http.controller';
import { StartTaskSessionCommandHandler } from './commands/start-task-session/start-task-session.command-handler';
import { StartTaskSessionHttpController } from './commands/start-task-session/start-task-session.http.controller';
import { UnlinkTaskSessionCommandHandler } from './commands/unlink-task-session/unlink-task-session.command-handler';
import { UnlinkTaskSessionHttpController } from './commands/unlink-task-session/unlink-task-session.http.controller';
import { UpdateMilestoneCommandHandler } from './commands/update-milestone/update-milestone.command-handler';
import { UpdateMilestoneHttpController } from './commands/update-milestone/update-milestone.http.controller';
import { UpdateTaskCommandHandler } from './commands/update-task/update-task.command-handler';
import { UpdateTaskHttpController } from './commands/update-task/update-task.http.controller';
import { MilestoneOrmEntity } from './database/milestone.orm-entity';
import { MilestoneRepository } from './database/milestone.repository';
import { TaskOrmEntity } from './database/task.orm-entity';
import { TaskRepository } from './database/task.repository';
import { TaskSessionOrmEntity } from './database/task-session.orm-entity';
import { MilestoneMapper } from './milestone.mapper';
import { FindMilestoneQueryHandler } from './queries/find-milestone/find-milestone.query-handler';
import { FindMilestonesHttpController } from './queries/find-milestones/find-milestones.http.controller';
import { FindMilestonesQueryHandler } from './queries/find-milestones/find-milestones.query-handler';
import { FindTaskHttpController } from './queries/find-task/find-task.http.controller';
import { FindTaskQueryHandler } from './queries/find-task/find-task.query-handler';
import { FindTasksHttpController } from './queries/find-tasks/find-tasks.http.controller';
import { FindTasksQueryHandler } from './queries/find-tasks/find-tasks.query-handler';
import { TaskMapper } from './task.mapper';
import { MILESTONE_REPOSITORY, TASK_REPOSITORY } from './tasks.di-tokens';
import { TaskResource } from './tasks.resource';

const httpControllers = [
  FindTasksHttpController,
  FindTaskHttpController,
  CreateTaskHttpController,
  UpdateTaskHttpController,
  MoveTaskHttpController,
  DeleteTaskHttpController,
  StartTaskSessionHttpController,
  LinkTaskSessionHttpController,
  UnlinkTaskSessionHttpController,
  FindMilestonesHttpController,
  CreateMilestoneHttpController,
  UpdateMilestoneHttpController,
  DeleteMilestoneHttpController,
];

const commandHandlers: Provider[] = [
  CreateTaskCommandHandler,
  UpdateTaskCommandHandler,
  MoveTaskCommandHandler,
  DeleteTaskCommandHandler,
  StartTaskSessionCommandHandler,
  LinkTaskSessionCommandHandler,
  UnlinkTaskSessionCommandHandler,
  CreateMilestoneCommandHandler,
  UpdateMilestoneCommandHandler,
  DeleteMilestoneCommandHandler,
];
const queryHandlers: Provider[] = [
  FindTasksQueryHandler,
  FindTaskQueryHandler,
  FindMilestonesQueryHandler,
  FindMilestoneQueryHandler,
];

/**
 * Plan's board (`product/versions/mvp/17-plan.md`): tasks, milestones and the links from
 * a task to its sessions. A session is started through the sessions module's own
 * command on the bus, so this module knows no session internals; the console joins
 * a task's links to the sessions it already lists.
 */
@Module({
  imports: [
    CqrsModule,
    TypeOrmModule.forFeature([TaskOrmEntity, MilestoneOrmEntity, TaskSessionOrmEntity]),
    AuthzKernelModule.forFeature([TaskResource]),
    // Whether a project can take a task, and the workspace's Unassigned project.
    ProjectsModule,
  ],
  controllers: [...httpControllers],
  providers: [
    ...commandHandlers,
    ...queryHandlers,
    TaskMapper,
    MilestoneMapper,
    TaskFilingResolver,
    { provide: TASK_REPOSITORY, useClass: TaskRepository },
    { provide: MILESTONE_REPOSITORY, useClass: MilestoneRepository },
  ],
})
export class TasksModule {}
