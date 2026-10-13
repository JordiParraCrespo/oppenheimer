import {
  heyApiSdk,
  type MilestoneResponseDto,
  type TaskResponseDto,
} from '@oppenheimer/api-client';
import { MapApiError, unwrap, unwrapBody } from '@oppenheimer/frontend-core';
import type { TaskStatus } from '@oppenheimer/shared/schemas/task';
import { injectable } from 'inversify';
import type { CreateSessionInput } from '../sessions/session.entity';
import { toCreateSessionRequest } from '../sessions/sessions.repository';
import {
  MilestoneEntity,
  type MilestoneInput,
  type TaskEntity as Task,
  TaskEntity,
  type TaskFilter,
  type TaskInput,
  type TaskMove,
} from './task.entity';
import { TasksErrors } from './tasks.errors';

function toTask(data: TaskResponseDto): Task {
  return new TaskEntity(
    data.id,
    data.projectId,
    data.milestoneId ?? null,
    data.status,
    data.rank,
    data.title,
    data.notes,
    data.dueDate ?? null,
    data.dueTime ?? null,
    data.completedAt ? new Date(data.completedAt) : null,
    data.sessions.map((link) => ({
      sessionId: link.sessionId,
      origin: link.origin,
      linkedAt: new Date(link.linkedAt),
    })),
    new Date(data.createdAt),
    new Date(data.updatedAt),
    data.blockedReason ?? null,
    data.version,
  );
}

function toMilestone(data: MilestoneResponseDto): MilestoneEntity {
  return new MilestoneEntity(
    data.id,
    data.projectId,
    data.name,
    data.targetDate ?? null,
    data.doneCount,
    data.totalCount,
    new Date(data.createdAt),
  );
}

/**
 * What a Start session sends: New session's input (filed under the task's project
 * by the API), and where the person saw the card.
 */
export interface StartTaskSessionInput {
  session: Omit<CreateSessionInput, 'projectId'>;
  seenStatus: TaskStatus;
  idempotencyKey: string;
}

export interface StartedTaskSession {
  task: Task;
  sessionId: string;
  /** `host_offline` when the session waits for its host. */
  hints: string[];
}

@injectable()
export class TasksRepository {
  @MapApiError(TasksErrors.FETCH_LIST_FAILED)
  async findAll(filter: TaskFilter = {}): Promise<Task[]> {
    const data = await unwrapBody(
      heyApiSdk.findTasks({ query: filter }),
      TasksErrors.FETCH_LIST_FAILED,
    );
    return data.map(toTask);
  }

  @MapApiError(TasksErrors.SAVE_FAILED)
  async create(input: TaskInput): Promise<Task> {
    const data = await unwrapBody(
      heyApiSdk.createTask({ body: { status: 'todo', ...input } }),
      TasksErrors.SAVE_FAILED,
    );
    return toTask(data);
  }

  @MapApiError(TasksErrors.SAVE_FAILED)
  async update(id: string, input: Partial<TaskInput>): Promise<Task> {
    const { status: _status, ...changes } = input;
    const data = await unwrapBody(
      heyApiSdk.updateTask({ path: { id }, body: changes }),
      TasksErrors.SAVE_FAILED,
    );
    return toTask(data);
  }

  @MapApiError(TasksErrors.MOVE_FAILED)
  async move(id: string, move: TaskMove): Promise<Task> {
    const data = await unwrapBody(
      heyApiSdk.moveTask({ path: { id }, body: move }),
      TasksErrors.MOVE_FAILED,
    );
    return toTask(data);
  }

  @MapApiError(TasksErrors.DELETE_FAILED)
  async remove(id: string): Promise<void> {
    await unwrap(heyApiSdk.deleteTask({ path: { id } }), TasksErrors.DELETE_FAILED);
  }

  @MapApiError(TasksErrors.START_SESSION_FAILED)
  async startSession(id: string, input: StartTaskSessionInput): Promise<StartedTaskSession> {
    const data = await unwrapBody(
      heyApiSdk.startTaskSession({
        path: { id },
        body: { session: toCreateSessionRequest(input.session), seenStatus: input.seenStatus },
        headers: { 'Idempotency-Key': input.idempotencyKey },
      }),
      TasksErrors.START_SESSION_FAILED,
    );
    return { task: toTask(data.task), sessionId: data.sessionId, hints: data.hints };
  }

  @MapApiError(TasksErrors.LINK_FAILED)
  async linkSession(id: string, sessionId: string, seenStatus: TaskStatus): Promise<Task> {
    const data = await unwrapBody(
      heyApiSdk.linkTaskSession({ path: { id, sessionId }, body: { seenStatus } }),
      TasksErrors.LINK_FAILED,
    );
    return toTask(data);
  }

  @MapApiError(TasksErrors.LINK_FAILED)
  async unlinkSession(id: string, sessionId: string): Promise<Task> {
    const data = await unwrapBody(
      heyApiSdk.unlinkTaskSession({ path: { id, sessionId } }),
      TasksErrors.LINK_FAILED,
    );
    return toTask(data);
  }

  @MapApiError(TasksErrors.FETCH_MILESTONES_FAILED)
  async findMilestones(): Promise<MilestoneEntity[]> {
    const data = await unwrapBody(heyApiSdk.findMilestones(), TasksErrors.FETCH_MILESTONES_FAILED);
    return data.map(toMilestone);
  }

  @MapApiError(TasksErrors.SAVE_MILESTONE_FAILED)
  async createMilestone(input: MilestoneInput): Promise<MilestoneEntity> {
    const data = await unwrapBody(
      heyApiSdk.createMilestone({ body: input }),
      TasksErrors.SAVE_MILESTONE_FAILED,
    );
    return toMilestone(data);
  }

  @MapApiError(TasksErrors.SAVE_MILESTONE_FAILED)
  async updateMilestone(id: string, input: Partial<MilestoneInput>): Promise<MilestoneEntity> {
    const data = await unwrapBody(
      heyApiSdk.updateMilestone({ path: { id }, body: input }),
      TasksErrors.SAVE_MILESTONE_FAILED,
    );
    return toMilestone(data);
  }

  @MapApiError(TasksErrors.DELETE_MILESTONE_FAILED)
  async removeMilestone(id: string): Promise<void> {
    await unwrap(heyApiSdk.deleteMilestone({ path: { id } }), TasksErrors.DELETE_MILESTONE_FAILED);
  }
}
