import {
  heyApiSdk,
  type MilestoneResponseDto,
  type TaskResponseDto,
} from '@oppenheimer/api-client';
import { callApi } from '@oppenheimer/frontend-core';
import type { TaskStatus } from '@oppenheimer/shared/schemas/task';
import { injectable } from 'inversify';
import type { CreateSessionInput, StartCloudSessionInput } from '../sessions/session.entity';
import {
  toCreateSessionRequest,
  toStartCloudSessionRequest,
} from '../sessions/sessions.repository';
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
 * What a Start session sends: New session's input for a session a host runs or
 * starts (Claude Code's cloud among them), or a vendor's cloud launch with no
 * host — either filed under the task's project by the API — and where the
 * person saw the card.
 */
export type StartTaskSessionInput = (
  | { session: CreateSessionInput & { projectId?: never }; cloud?: never }
  | { cloud: Omit<StartCloudSessionInput, 'projectId'>; session?: never }
) & {
  seenStatus: TaskStatus;
  idempotencyKey: string;
};

export interface StartedTaskSession {
  task: Task;
  sessionId: string;
  /** `host_offline` when the session waits for its host. */
  hints: string[];
}

@injectable()
export class TasksRepository {
  findAll(filter: TaskFilter = {}): Promise<Task[]> {
    return callApi(TasksErrors.FETCH_LIST_FAILED, async (api) => {
      const data = await api.body(heyApiSdk.findTasks({ query: filter }));
      return data.map(toTask);
    });
  }

  create(input: TaskInput): Promise<Task> {
    return callApi(TasksErrors.SAVE_FAILED, async (api) => {
      const data = await api.body(heyApiSdk.createTask({ body: { status: 'todo', ...input } }));
      return toTask(data);
    });
  }

  update(id: string, input: Partial<TaskInput>): Promise<Task> {
    return callApi(TasksErrors.SAVE_FAILED, async (api) => {
      const { status: _status, ...changes } = input;
      const data = await api.body(heyApiSdk.updateTask({ path: { id }, body: changes }));
      return toTask(data);
    });
  }

  move(id: string, move: TaskMove): Promise<Task> {
    return callApi(TasksErrors.MOVE_FAILED, async (api) => {
      const data = await api.body(heyApiSdk.moveTask({ path: { id }, body: move }));
      return toTask(data);
    });
  }

  remove(id: string): Promise<void> {
    return callApi(TasksErrors.DELETE_FAILED, async (api) => {
      await api.result(heyApiSdk.deleteTask({ path: { id } }));
    });
  }

  startSession(id: string, input: StartTaskSessionInput): Promise<StartedTaskSession> {
    return callApi(TasksErrors.START_SESSION_FAILED, async (api) => {
      const headers = { 'Idempotency-Key': input.idempotencyKey };
      const data = await api.body(
        input.cloud
          ? heyApiSdk.startTaskCloudSession({
              path: { id },
              body: {
                cloud: toStartCloudSessionRequest(input.cloud),
                seenStatus: input.seenStatus,
              },
              headers,
            })
          : heyApiSdk.startTaskSession({
              path: { id },
              body: {
                session: toCreateSessionRequest(input.session),
                seenStatus: input.seenStatus,
              },
              headers,
            }),
      );
      return { task: toTask(data.task), sessionId: data.sessionId, hints: data.hints };
    });
  }

  linkSession(id: string, sessionId: string, seenStatus: TaskStatus): Promise<Task> {
    return callApi(TasksErrors.LINK_FAILED, async (api) => {
      const data = await api.body(
        heyApiSdk.linkTaskSession({ path: { id, sessionId }, body: { seenStatus } }),
      );
      return toTask(data);
    });
  }

  unlinkSession(id: string, sessionId: string): Promise<Task> {
    return callApi(TasksErrors.LINK_FAILED, async (api) => {
      const data = await api.body(heyApiSdk.unlinkTaskSession({ path: { id, sessionId } }));
      return toTask(data);
    });
  }

  findMilestones(): Promise<MilestoneEntity[]> {
    return callApi(TasksErrors.FETCH_MILESTONES_FAILED, async (api) => {
      const data = await api.body(heyApiSdk.findMilestones());
      return data.map(toMilestone);
    });
  }

  createMilestone(input: MilestoneInput): Promise<MilestoneEntity> {
    return callApi(TasksErrors.SAVE_MILESTONE_FAILED, async (api) => {
      const data = await api.body(heyApiSdk.createMilestone({ body: input }));
      return toMilestone(data);
    });
  }

  updateMilestone(id: string, input: Partial<MilestoneInput>): Promise<MilestoneEntity> {
    return callApi(TasksErrors.SAVE_MILESTONE_FAILED, async (api) => {
      const data = await api.body(heyApiSdk.updateMilestone({ path: { id }, body: input }));
      return toMilestone(data);
    });
  }

  removeMilestone(id: string): Promise<void> {
    return callApi(TasksErrors.DELETE_MILESTONE_FAILED, async (api) => {
      await api.result(heyApiSdk.deleteMilestone({ path: { id } }));
    });
  }
}
