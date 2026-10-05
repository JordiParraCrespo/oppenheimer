import {
  type CreateSessionRequest,
  heyApiSdk,
  type SessionCheckoutResponseDto,
  type SessionResponseDto,
} from '@oppenheimer/api-client';
import { AppError, MapApiError, unwrap, unwrapBody } from '@oppenheimer/frontend-core';
import { PAGINATION } from '@oppenheimer/shared/constants';
import { SESSION_FILE_MAX_BYTES } from '@oppenheimer/shared/protocol';
import { injectable } from 'inversify';
import { CONSUMER_CONFIG } from '../../config';
import {
  type AttachTicket,
  type CreateSessionInput,
  type PrepareSessionInput,
  type SessionAttachment,
  SessionCheckoutEntity,
  SessionEntity,
} from './session.entity';
import { type SessionStartEntry, settlesStart, toStartEntry } from './session-steps';
import { SessionsErrors } from './sessions.errors';

/**
 * The wire shapes come from the generated client (`pnpm generate:api-client`,
 * from the API's own OpenAPI), so a field the API renames cannot stay right
 * here and wrong there. Call the generated operations rather than composing
 * URLs by hand.
 */

function toCheckout(data: SessionCheckoutResponseDto): SessionCheckoutEntity {
  return new SessionCheckoutEntity(
    data.id,
    data.installationId,
    data.githubRepoId,
    data.repositoryFullName,
    data.directoryName,
    data.baseBranch,
    data.branch,
  );
}

function toEntity(data: SessionResponseDto): SessionEntity {
  return new SessionEntity(
    data.id,
    data.organizationId,
    data.projectId,
    data.hostId,
    data.name,
    data.slug,
    data.agent,
    {
      model: data.launch.model ?? null,
      permission: data.launch.permission ?? null,
      effort: data.launch.effort ?? null,
    },
    data.state,
    data.lifecycle,
    data.cwdCheckoutId ?? null,
    data.checkouts.map(toCheckout),
    data.stoppedAt ? new Date(data.stoppedAt) : null,
    data.hints ?? [],
    new Date(data.createdAt),
  );
}

/**
 * `launch` is sent only when the caller chose something: an empty object would
 * be the API's defaults spelled out by a client that did not know them, and the
 * one default that matters — the permission level — is the API's to state.
 */
function toRequest(input: CreateSessionInput): CreateSessionRequest {
  const launch = input.launch
    ? {
        ...(input.launch.model ? { model: input.launch.model } : {}),
        ...(input.launch.permission ? { permission: input.launch.permission } : {}),
        ...(input.launch.effort ? { effort: input.launch.effort } : {}),
      }
    : undefined;

  return {
    hostId: input.hostId,
    agent: input.agent,
    checkouts: input.checkouts,
    ...(input.cwdGithubRepoId !== undefined ? { cwdGithubRepoId: input.cwdGithubRepoId } : {}),
    ...(launch && Object.keys(launch).length ? { launch } : {}),
    ...(input.prompt ? { prompt: input.prompt } : {}),
    ...(input.attachmentIds?.length ? { attachmentIds: input.attachmentIds } : {}),
    ...(input.name ? { name: input.name } : {}),
    ...(input.projectId ? { projectId: input.projectId } : {}),
  };
}

@injectable()
export class SessionsRepository {
  /**
   * Every session in the workspace, whatever the endpoint's page size: the
   * sidebar groups, searches and filters the whole list in the browser, so a
   * page would be a list that silently ends.
   *
   * The list is walked **by cursor**, at the largest page the API allows, until
   * `meta.nextCursor` is null: no page pays for an offset or a count, and a
   * session whose activity moves it up the list mid-walk is never read twice.
   */
  @MapApiError(SessionsErrors.FETCH_LIST_FAILED)
  async findAll(): Promise<SessionEntity[]> {
    const sessions: SessionEntity[] = [];
    let cursor: string | undefined;
    for (;;) {
      const data = await unwrapBody(
        heyApiSdk.findSessions({
          query: { limit: PAGINATION.MAX_LIMIT, ...(cursor ? { cursor } : {}) },
        }),
        SessionsErrors.FETCH_LIST_FAILED,
        (body) => Array.isArray(body.data),
      );
      sessions.push(...data.data.map(toEntity));
      const next = data.meta.nextCursor;
      // A cursor the walk already sent would loop for ever; stop instead.
      if (!next || next === cursor) return sessions;
      cursor = next;
    }
  }

  /**
   * The failure keeps the response's status, as every call here does, and this
   * read leans on it: `isSessionNotFound` tells a 404 from a read worth retrying.
   */
  @MapApiError(SessionsErrors.FETCH_ONE_FAILED)
  async findById(id: string): Promise<SessionEntity> {
    const data = await unwrapBody(
      heyApiSdk.findSession({ path: { id } }),
      SessionsErrors.FETCH_ONE_FAILED,
    );
    return toEntity(data);
  }

  /**
   * The `Idempotency-Key` is not optional in practice: a session is
   * directories, a git checkout and a process on somebody's machine, and a
   * retry after a lost response must hand back the session already created
   * instead of building a second worktree and a second branch. The key is the
   * caller's to mint (`CreateSessionVariables`).
   */
  @MapApiError(SessionsErrors.CREATE_FAILED)
  async create(input: CreateSessionInput, idempotencyKey: string): Promise<SessionEntity> {
    const data = await unwrapBody(
      heyApiSdk.createSession({
        body: toRequest(input),
        headers: { 'Idempotency-Key': idempotencyKey },
      }),
      SessionsErrors.CREATE_FAILED,
    );
    return toEntity(data);
  }

  /**
   * Asks the host to clone or fetch the draft's repository and make a spare
   * worktree, so the create that follows does not wait on git. Answers the
   * hints only: whether the host was told.
   */
  @MapApiError(SessionsErrors.PREPARE_FAILED)
  async prepare(input: PrepareSessionInput): Promise<string[]> {
    const data = await unwrapBody(
      heyApiSdk.prepareSession({ body: input }),
      SessionsErrors.PREPARE_FAILED,
    );
    return data.hints;
  }

  /**
   * The start of the session's log, up to the entry that says how the start
   * ended, parsed against the schema the runner writes. It walks the log's
   * pages rather than trusting one to hold it: a start is a handful of entries
   * today, and a namer event or a retry is how that stops being true.
   */
  @MapApiError(SessionsErrors.FETCH_EVENTS_FAILED)
  async findStartLog(id: string): Promise<SessionStartEntry[]> {
    const entries: SessionStartEntry[] = [];
    let afterSeq: number | undefined;
    for (let page = 0; page < CONSUMER_CONFIG.sessions.maxStartLogPages; page += 1) {
      const data = await unwrapBody(
        heyApiSdk.findSessionEvents({
          path: { id },
          query: { limit: CONSUMER_CONFIG.sessions.startLogPageSize, afterSeq },
        }),
        SessionsErrors.FETCH_EVENTS_FAILED,
        (body) => Array.isArray(body.data),
      );
      for (const raw of data.data) {
        const entry = toStartEntry(raw);
        if (!entry) continue;
        entries.push(entry);
        if (settlesStart(entry)) return entries;
      }
      if (data.nextSeq === null || data.nextSeq === undefined) return entries;
      afterSeq = data.nextSeq;
    }
    return entries;
  }

  /** Display only: the slug, the directory and the branch never change. */
  @MapApiError(SessionsErrors.RENAME_FAILED)
  async rename(id: string, name: string): Promise<SessionEntity> {
    const data = await unwrapBody(
      heyApiSdk.renameSession({ path: { id }, body: { name } }),
      SessionsErrors.RENAME_FAILED,
    );
    return toEntity(data);
  }

  /** To a project that holds the session's repository; nothing on the host moves. */
  @MapApiError(SessionsErrors.MOVE_FAILED)
  async move(id: string, projectId: string): Promise<SessionEntity> {
    const data = await unwrapBody(
      heyApiSdk.moveSession({ path: { id }, body: { projectId } }),
      SessionsErrors.MOVE_FAILED,
    );
    return toEntity(data);
  }

  /**
   * Close: the session stops, its worktree leaves the host, and the row stays
   * resolved so its directory name and branch are never reissued. Work that is
   * not pushed refuses the close unless the caller accepts losing it.
   */
  @MapApiError(SessionsErrors.CLOSE_FAILED)
  /**
   * Bring a stopped session's terminal back. The host recreates window 0 in the
   * worktrees the session already has and reopens the agent's own conversation,
   * so what comes back is the session as it was rather than a second one.
   */
  async restart(id: string): Promise<SessionEntity> {
    const data = await unwrapBody(
      heyApiSdk.restartSession({ path: { id } }),
      SessionsErrors.RESTART_FAILED,
    );
    return toEntity(data);
  }

  async close(id: string, acceptUnpushedWork = false): Promise<SessionEntity> {
    const data = await unwrapBody(
      heyApiSdk.closeSession({
        path: { id },
        query: acceptUnpushedWork ? { acceptUnpushedWork } : undefined,
      }),
      SessionsErrors.CLOSE_FAILED,
    );
    return toEntity(data);
  }

  /**
   * A pass to open one window's terminal. Never cached and never retried on
   * its own: the ticket is single use and sixty seconds.
   */
  @MapApiError(SessionsErrors.ATTACH_TICKET_FAILED)
  async issueAttachTicket(id: string, window = 0): Promise<AttachTicket> {
    const data = await unwrapBody(
      heyApiSdk.issueAttachTicket({ path: { id }, body: { window } }),
      SessionsErrors.ATTACH_TICKET_FAILED,
    );
    return {
      ticket: data.ticket,
      url: data.url,
      expiresAt: new Date(data.expiresAt),
      window: data.window,
    };
  }

  /**
   * A file (an image, a PDF, text) for a session that does not exist yet:
   * kept briefly by the API for the `create` that names its id in `attachmentIds`. A file over the cap
   * is refused here, before it is sent; the API judges the type by the bytes.
   */
  @MapApiError(SessionsErrors.UPLOAD_ATTACHMENT_FAILED)
  async uploadAttachment(file: Blob): Promise<SessionAttachment> {
    if (file.size > SESSION_FILE_MAX_BYTES) throw new AppError(SessionsErrors.FILE_TOO_LARGE);
    const data = await unwrapBody(
      heyApiSdk.uploadSessionAttachment({ body: { file: file } }),
      SessionsErrors.UPLOAD_ATTACHMENT_FAILED,
    );
    return { id: data.id, mediaType: data.mediaType, size: data.size };
  }

  /**
   * A file for one window's prompt. The agent reads its host's clipboard,
   * not the browser's, so the file goes to the host and the runner pastes
   * its path in. A file over the cap is refused here, before it is sent; the
   * API judges the type by the bytes and answers an unreachable host as an
   * error, so a resolved call means the host has it.
   */
  @MapApiError(SessionsErrors.PASTE_FILE_FAILED)
  async pasteFile(id: string, file: Blob, window = 0): Promise<void> {
    if (file.size > SESSION_FILE_MAX_BYTES) throw new AppError(SessionsErrors.FILE_TOO_LARGE);
    await unwrap(
      heyApiSdk.pasteSessionImage({ path: { id }, body: { file: file, window } }),
      SessionsErrors.PASTE_FILE_FAILED,
    );
  }
}
