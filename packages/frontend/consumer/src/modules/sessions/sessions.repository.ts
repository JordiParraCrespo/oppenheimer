import { heyApiClient } from '@oppenheimer/api-client';
import { AppError, MapApiError } from '@oppenheimer/frontend-core';
import type { PaginatedResponse } from '@oppenheimer/shared';
import { injectable } from 'inversify';
import {
  type CreateSessionInput,
  type SessionAgent,
  SessionEntity,
  type SessionState,
} from './session.entity';
import { SessionsErrors } from './sessions.errors';

/**
 * The wire shape of a session, as the control plane's `sessions` module will
 * answer it (`product/versions/mvp/03-control-plane.md`, data model: sessions
 * — host, repo, base branch, branch, worktree path, agent, state, name).
 * Declared here until the endpoints exist and the typed SDK in
 * `@oppenheimer/api-client` is regenerated from them; then this file switches
 * to `SessionsApi` like every other repository and the DTO below goes.
 */
interface SessionDto {
  id: string;
  name: string;
  hostId: string;
  repository: string;
  baseBranch: string;
  branch: string;
  agent: SessionAgent;
  state: SessionState;
  createdAt: string;
}

const SESSIONS_URL = '/api/v1/sessions';

function toEntity(data: SessionDto): SessionEntity {
  return new SessionEntity(
    data.id,
    data.name,
    data.hostId,
    data.repository,
    data.baseBranch,
    data.branch,
    data.agent,
    data.state,
    new Date(data.createdAt),
  );
}

@injectable()
export class SessionsRepository {
  /**
   * The caller's sessions.
   *
   * `GET /sessions` answers the paginated envelope every list endpoint here
   * uses — `{ data, meta }` — so the rows are read out of it rather than off
   * the body. Mapping the envelope itself threw `data.map is not a function`
   * on every call, which nothing noticed because nothing called it: the
   * sessions screen is still its own empty state.
   */
  @MapApiError(SessionsErrors.FETCH_LIST_FAILED)
  async findAll(): Promise<SessionEntity[]> {
    const { data, error } = await heyApiClient.get<PaginatedResponse<SessionDto>>({
      url: SESSIONS_URL,
    });
    // An absent body is a failed read, not an empty collection — returning `[]`
    // would render "no sessions" over a request that never succeeded.
    if (error || !data?.data) throw new AppError(SessionsErrors.FETCH_LIST_FAILED);
    return data.data.map(toEntity);
  }

  @MapApiError(SessionsErrors.FETCH_ONE_FAILED)
  async findById(id: string): Promise<SessionEntity> {
    const { data, error } = await heyApiClient.get<SessionDto>({
      url: `${SESSIONS_URL}/{id}`,
      path: { id },
    });
    if (error || !data) throw new AppError(SessionsErrors.FETCH_ONE_FAILED);
    return toEntity(data);
  }

  @MapApiError(SessionsErrors.CREATE_FAILED)
  async create(input: CreateSessionInput): Promise<SessionEntity> {
    const { data, error } = await heyApiClient.post<SessionDto>({ url: SESSIONS_URL, body: input });
    if (error || !data) throw new AppError(SessionsErrors.CREATE_FAILED);
    return toEntity(data);
  }

  @MapApiError(SessionsErrors.STOP_FAILED)
  async stop(id: string): Promise<void> {
    const { error } = await heyApiClient.post({ url: `${SESSIONS_URL}/{id}/stop`, path: { id } });
    if (error) throw new AppError(SessionsErrors.STOP_FAILED);
  }
}
