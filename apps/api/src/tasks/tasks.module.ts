import { Module, type Provider } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthzModule as AuthzKernelModule } from '@oppenheimer/backend-authz';
import { ProjectsModule } from '../projects/projects.module';
import { TaskFilingResolver } from './application/task-filing.resolver';
import { CreateGoalCommandHandler } from './commands/create-goal/create-goal.command-handler';
import { CreateGoalHttpController } from './commands/create-goal/create-goal.http.controller';
import { CreateTaskCommandHandler } from './commands/create-task/create-task.command-handler';
import { CreateTaskHttpController } from './commands/create-task/create-task.http.controller';
import { DeleteGoalCommandHandler } from './commands/delete-goal/delete-goal.command-handler';
import { DeleteGoalHttpController } from './commands/delete-goal/delete-goal.http.controller';
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
import { UpdateGoalCommandHandler } from './commands/update-goal/update-goal.command-handler';
import { UpdateGoalHttpController } from './commands/update-goal/update-goal.http.controller';
import { UpdateTaskCommandHandler } from './commands/update-task/update-task.command-handler';
import { UpdateTaskHttpController } from './commands/update-task/update-task.http.controller';
import { GoalOrmEntity } from './database/goal.orm-entity';
import { GoalRepository } from './database/goal.repository';
import { TaskOrmEntity } from './database/task.orm-entity';
import { TaskRepository } from './database/task.repository';
import { TaskSessionOrmEntity } from './database/task-session.orm-entity';
import { GoalMapper } from './goal.mapper';
import { FindGoalQueryHandler } from './queries/find-goal/find-goal.query-handler';
import { FindGoalsHttpController } from './queries/find-goals/find-goals.http.controller';
import { FindGoalsQueryHandler } from './queries/find-goals/find-goals.query-handler';
import { FindTaskHttpController } from './queries/find-task/find-task.http.controller';
import { FindTaskQueryHandler } from './queries/find-task/find-task.query-handler';
import { FindTasksHttpController } from './queries/find-tasks/find-tasks.http.controller';
import { FindTasksQueryHandler } from './queries/find-tasks/find-tasks.query-handler';
import { TaskMapper } from './task.mapper';
import { GOAL_REPOSITORY, TASK_REPOSITORY } from './tasks.di-tokens';
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
  FindGoalsHttpController,
  CreateGoalHttpController,
  UpdateGoalHttpController,
  DeleteGoalHttpController,
];

const commandHandlers: Provider[] = [
  CreateTaskCommandHandler,
  UpdateTaskCommandHandler,
  MoveTaskCommandHandler,
  DeleteTaskCommandHandler,
  StartTaskSessionCommandHandler,
  LinkTaskSessionCommandHandler,
  UnlinkTaskSessionCommandHandler,
  CreateGoalCommandHandler,
  UpdateGoalCommandHandler,
  DeleteGoalCommandHandler,
];
const queryHandlers: Provider[] = [
  FindTasksQueryHandler,
  FindTaskQueryHandler,
  FindGoalsQueryHandler,
  FindGoalQueryHandler,
];

/**
 * Plan's board (`product/versions/mvp/17-plan.md`): tasks, goals and the links from
 * a task to its sessions. A session is started through the sessions module's own
 * command on the bus, so this module knows no session internals; the console joins
 * a task's links to the sessions it already lists.
 */
@Module({
  imports: [
    CqrsModule,
    TypeOrmModule.forFeature([TaskOrmEntity, GoalOrmEntity, TaskSessionOrmEntity]),
    AuthzKernelModule.forFeature([TaskResource]),
    // Whether a project can take a task, and the workspace's Unassigned project.
    ProjectsModule,
  ],
  controllers: [...httpControllers],
  providers: [
    ...commandHandlers,
    ...queryHandlers,
    TaskMapper,
    GoalMapper,
    TaskFilingResolver,
    { provide: TASK_REPOSITORY, useClass: TaskRepository },
    { provide: GOAL_REPOSITORY, useClass: GoalRepository },
  ],
})
export class TasksModule {}
