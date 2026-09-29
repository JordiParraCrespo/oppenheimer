import {
  type CreateSessionRequest,
  heyApiSdk,
  type SessionCheckoutResponseDto,
  type SessionResponseDto,
} from '@oppenheimer/api-client';
import { AppError, MapApiError, unwrap, unwrapBody } from '@oppenheimer/frontend-core';
import { PAGINATION } from '@oppenheimer/shared/constants';
import { SESSION_IMAGE_MAX_BYTES } from '@oppenheimer/shared/protocol';
import { injectable } from 'inversify';
import { CONSUMER_CONFIG } from '../../config';
import {
  type AttachTicket,
  type CreateSessionInput,
  SessionCheckoutEntity,
  SessionEntity,
} from './session.entity';
import { type SessionStartEntry, settlesStart, toStartEntry } from './session-steps';
import { SessionsErrors } from './sessions.errors';

/**
 * The wire shapes come from the generated client: `pnpm generate:api-client`
 * writes them from the API's own OpenAPI, so a field the API renames cannot
 * stay right here and wrong there.
 *
 * They were hand-written here once, against a single-repository session with a
 * `running | idle | stopped` state — a shape the control plane had already
 * replaced with checkouts, a derived group and a stored lifecycle. Nothing
 * noticed, because nothing called it. That is the whole argument for calling the
 * generated operations rather than composing URLs by hand.
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
 * The body `POST /sessions` takes.
 *
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
   * `GET /sessions` answers the paginated envelope every list endpoint here
   * uses — `{ data, meta }` — so the rows are read out of it rather than off the
   * body. The list is walked **by cursor**, at the largest page the API allows,
   * until `meta.nextCursor` is null: no page pays for an offset or a count, and a
   * session whose activity moves it up the list mid-walk is never read twice.
   */
  @MapApiError(SessionsErrors.FETCH_LIST_FAILED)
  async findAll(): Promise<SessionEntity[]> {
    const sessions: SessionEntity[] = [];
    let cursor: string | undefined;
    for (;;) {
      // An absent body is a failed read, not an empty collection — returning
      // `[]` would render "no sessions" over a request that never succeeded.
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
   * One session.
   *
   * The failure keeps the response's status, as every call here does, and this
   * read leans on it: the console's session route has to tell a mistyped or
   * closed session id — a 404, and a destination that will never exist — from
   * a read that failed and is worth retrying.
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
   * Start a session.
   *
   * The `Idempotency-Key` is not optional in practice and so is minted here
   * rather than asked of the caller: a session is directories, a git checkout
   * and a process on somebody's machine, and a retry after a lost response must
   * hand back the session already created instead of building a second worktree
   * and a second branch.
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
   * A pass to open one window's terminal.
   *
   * Never cached and never retried on its own: the ticket is single use and
   * sixty seconds, so the only right time to mint one is the moment a socket is
   * about to be opened with it.
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
   * An image for one window's prompt. The agent reads its host's clipboard,
   * not the browser's, so the image goes to the host and the runner pastes
   * its path in. A file over the cap is refused here, before it is sent; the
   * API judges the type by the bytes and answers an unreachable host as an
   * error, so a resolved call means the host has it.
   */
  @MapApiError(SessionsErrors.PASTE_IMAGE_FAILED)
  async pasteImage(id: string, image: Blob, window = 0): Promise<void> {
    if (image.size > SESSION_IMAGE_MAX_BYTES) throw new AppError(SessionsErrors.IMAGE_TOO_LARGE);
    await unwrap(
      heyApiSdk.pasteSessionImage({ path: { id }, body: { file: image, window } }),
      SessionsErrors.PASTE_IMAGE_FAILED,
    );
  }
}
