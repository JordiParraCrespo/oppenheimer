import {
  type CreateSessionRequest,
  heyApiSdk,
  type SessionCheckoutResponseDto,
  type SessionResponseDto,
} from '@oppenheimer/api-client';
import { AppError, MapApiError, toAppError } from '@oppenheimer/frontend-core';
import { injectable } from 'inversify';
import {
  type AttachTicket,
  type CreateSessionInput,
  type PastedImage,
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
/** Entries per page of the start log, and how many pages a start may span. */
const START_LOG_PAGE = 50;
const MAX_START_LOG_PAGES = 20;

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
    data.agent as SessionEntity['agent'],
    {
      model: data.launch.model ?? null,
      permission: data.launch.permission,
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
   * The caller's sessions.
   *
   * `GET /sessions` answers the paginated envelope every list endpoint here
   * uses — `{ data, meta }` — so the rows are read out of it rather than off
   * the body.
   */
  @MapApiError(SessionsErrors.FETCH_LIST_FAILED)
  async findAll(): Promise<SessionEntity[]> {
    const { data, error } = await heyApiSdk.listSessions();
    // An absent body is a failed read, not an empty collection — returning `[]`
    // would render "no sessions" over a request that never succeeded.
    if (error || !data?.data) throw new AppError(SessionsErrors.FETCH_LIST_FAILED);
    return data.data.map(toEntity);
  }

  /**
   * One session.
   *
   * The failure keeps the response's status, which the other reads here do not
   * need and this one does: the console's session route has to tell a mistyped
   * or closed session id — a 404, and a destination that will never exist —
   * from a read that failed and is worth retrying. `toAppError` is the same
   * normaliser `MapApiError` uses, so a problem document the API sent still
   * reaches the screen.
   */
  @MapApiError(SessionsErrors.FETCH_ONE_FAILED)
  async findById(id: string): Promise<SessionEntity> {
    const { data, error, response } = await heyApiSdk.getSession({ path: { id } });
    if (error || !data) {
      throw toAppError({ status: response?.status, body: error }, SessionsErrors.FETCH_ONE_FAILED);
    }
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
    const { data, error } = await heyApiSdk.createSession({
      body: toRequest(input),
      headers: { 'Idempotency-Key': idempotencyKey },
    });
    if (error || !data) throw new AppError(SessionsErrors.CREATE_FAILED);
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
    for (let page = 0; page < MAX_START_LOG_PAGES; page += 1) {
      const { data, error } = await heyApiSdk.listSessionEvents({
        path: { id },
        query: { limit: START_LOG_PAGE, afterSeq },
      });
      if (error || !data?.data) throw new AppError(SessionsErrors.FETCH_EVENTS_FAILED);
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

  @MapApiError(SessionsErrors.STOP_FAILED)
  async stop(id: string): Promise<SessionEntity> {
    const { data, error } = await heyApiSdk.stopSession({ path: { id } });
    if (error || !data) throw new AppError(SessionsErrors.STOP_FAILED);
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
    const { data, error, response } = await heyApiSdk.issueAttachTicket({
      path: { id },
      body: { window },
    });
    if (error || !data) {
      throw toAppError(
        { status: response?.status, body: error },
        SessionsErrors.ATTACH_TICKET_FAILED,
      );
    }
    return {
      ticket: data.ticket,
      url: data.url,
      expiresAt: new Date(data.expiresAt),
      window: data.window,
    };
  }

  /**
   * An image for one window's prompt. The agent reads its host's clipboard,
   * not the browser's, so the image travels to the host and the runner pastes
   * its path in. The API judges the type by the bytes and caps the size.
   */
  @MapApiError(SessionsErrors.PASTE_IMAGE_FAILED)
  async pasteImage(id: string, image: Blob, window = 0): Promise<PastedImage> {
    const { data, error, response } = await heyApiSdk.pasteSessionImage({
      path: { id },
      body: { file: image, window },
    });
    if (error || !data) {
      throw toAppError(
        { status: response?.status, body: error },
        SessionsErrors.PASTE_IMAGE_FAILED,
      );
    }
    return { delivered: data.delivered, hostOffline: data.hints.includes('host_offline') };
  }
}
