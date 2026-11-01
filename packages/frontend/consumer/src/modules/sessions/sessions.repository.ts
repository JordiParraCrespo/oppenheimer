import {
  type CreateSessionRequest,
  heyApiSdk,
  type SessionCheckoutResponseDto,
  type SessionResponseDto,
  type SessionShareResponseDto,
  type StartCloudSessionRequest,
} from '@oppenheimer/api-client';
import { AppError, callApi } from '@oppenheimer/frontend-core';
import { PAGINATION } from '@oppenheimer/shared/constants';
import { SESSION_FILE_MAX_BYTES } from '@oppenheimer/shared/protocol';
import type {
  AnswerSessionDecisionDto,
  SessionDecision,
} from '@oppenheimer/shared/schemas/session-decision';
import type { PutSessionShareDto } from '@oppenheimer/shared/schemas/session-share';
import { injectable } from 'inversify';
import { CONSUMER_CONFIG } from '../../config';
import {
  type AttachTicket,
  type CreateSessionInput,
  type PrepareSessionInput,
  type SessionAttachment,
  SessionCheckoutEntity,
  SessionEntity,
  type SessionPorts,
  type SessionPreview,
  type SessionShare,
  type SharedSession,
  type StartCloudSessionInput,
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

function toShare(data: SessionShareResponseDto): SessionShare {
  return {
    id: data.id,
    slug: data.slug,
    audience: data.audience,
    access: data.access,
    people: data.people,
    expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
    sharedBy: data.sharedBy ?? null,
    updatedAt: new Date(data.updatedAt),
  };
}

function toTicket(data: { ticket: string; url: string; expiresAt: string; window: number }) {
  return {
    ticket: data.ticket,
    url: data.url,
    expiresAt: new Date(data.expiresAt),
    window: data.window,
  };
}

/** The decision as the console holds it; what the API leaves out is null. */
function toDecision(data: SessionResponseDto['decision']): SessionDecision | null {
  if (!data) return null;
  if (data.kind === 'permission') {
    return {
      kind: 'permission',
      id: data.id,
      title: data.title,
      detail: data.detail ?? null,
      options: data.options.map((option) => ({ label: option.label })),
    };
  }
  return {
    kind: 'question',
    id: data.id,
    questions: data.questions.map((question) => ({
      header: question.header ?? null,
      question: question.question,
      multiSelect: question.multiSelect,
      options: question.options.map((option) => ({
        label: option.label,
        description: option.description ?? null,
      })),
    })),
  };
}

function toEntity(data: SessionResponseDto): SessionEntity {
  return new SessionEntity({
    id: data.id,
    organizationId: data.organizationId,
    projectId: data.projectId,
    hostId: data.hostId,
    name: data.name,
    slug: data.slug,
    agent: data.agent,
    launch: {
      model: data.launch.model ?? null,
      permission: data.launch.permission ?? null,
      effort: data.launch.effort ?? null,
    },
    state: data.state,
    lifecycle: data.lifecycle,
    cwdCheckoutId: data.cwdCheckoutId ?? null,
    checkouts: data.checkouts.map(toCheckout),
    stoppedAt: data.stoppedAt ? new Date(data.stoppedAt) : null,
    hints: data.hints ?? [],
    createdAt: new Date(data.createdAt),
    place: data.place,
    folderPath: data.folderPath ?? null,
    closeRequest: data.closeRequest
      ? {
          requestedAt: new Date(data.closeRequest.requestedAt),
          acceptUnpushedWork: data.closeRequest.acceptUnpushedWork,
        }
      : null,
    closeRefusal: data.closeRefusal
      ? { code: data.closeRefusal.code, detail: data.closeRefusal.detail ?? null }
      : null,
    observedSince: data.observedSince ? new Date(data.observedSince) : null,
    lastEventAt: data.lastEventAt ? new Date(data.lastEventAt) : null,
    stateSeq: data.stateSeq ?? 0,
    decision: toDecision(data.decision),
    cloud: data.cloud
      ? {
          provider: data.cloud.provider,
          url: data.cloud.url ?? null,
          repositoryUrl: data.cloud.repositoryUrl,
          status: data.cloud.status,
          branch: data.cloud.branch ?? null,
          pullRequestUrl: data.cloud.pullRequestUrl ?? null,
          syncedAt: new Date(data.cloud.syncedAt),
        }
      : null,
    cloudSessionId: data.cloudSessionId ?? null,
  });
}

/**
 * `launch` is sent only when the caller chose something: an empty object would
 * be the API's defaults spelled out by a client that did not know them, and the
 * one default that matters — the permission level — is the API's to state.
 */
export function toStartCloudSessionRequest(
  input: StartCloudSessionInput,
): StartCloudSessionRequest {
  return {
    provider: input.provider,
    checkout: input.checkout,
    prompt: input.prompt,
    ...(input.projectId ? { projectId: input.projectId } : {}),
    ...(input.model ? { model: input.model } : {}),
  };
}

export function toCreateSessionRequest(input: CreateSessionInput): CreateSessionRequest {
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
    ...(input.folder !== undefined
      ? { folder: input.folder }
      : {
          checkouts: input.checkouts,
          ...(input.cwdGithubRepoId !== undefined
            ? { cwdGithubRepoId: input.cwdGithubRepoId }
            : {}),
          ...(input.cloud ? { cloud: true } : {}),
          ...(input.codexEnvironment ? { codexEnvironment: input.codexEnvironment } : {}),
        }),
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
  findAll(): Promise<SessionEntity[]> {
    return callApi(SessionsErrors.FETCH_LIST_FAILED, async (api) => {
      const sessions: SessionEntity[] = [];
      let cursor: string | undefined;
      for (;;) {
        const data = await api.body(
          heyApiSdk.findSessions({
            query: { limit: PAGINATION.MAX_LIMIT, ...(cursor ? { cursor } : {}) },
          }),
          (body) => Array.isArray(body.data),
        );
        sessions.push(...data.data.map(toEntity));
        const next = data.meta.nextCursor;
        // A cursor the walk already sent would loop for ever; stop instead.
        if (!next || next === cursor) return sessions;
        cursor = next;
      }
    });
  }

  /**
   * The failure keeps the response's status, as every call here does, and this
   * read leans on it: `isSessionNotFound` tells a 404 from a read worth retrying.
   */
  findById(id: string): Promise<SessionEntity> {
    return callApi(SessionsErrors.FETCH_ONE_FAILED, async (api) => {
      const data = await api.body(heyApiSdk.findSession({ path: { id } }));
      return toEntity(data);
    });
  }

  /**
   * The `Idempotency-Key` is not optional in practice: a session is
   * directories, a git checkout and a process on somebody's machine, and a
   * retry after a lost response must hand back the session already created
   * instead of building a second worktree and a second branch. The key is the
   * caller's to mint (`CreateSessionVariables`).
   */
  create(input: CreateSessionInput, idempotencyKey: string): Promise<SessionEntity> {
    return callApi(SessionsErrors.CREATE_FAILED, async (api) => {
      const data = await api.body(
        heyApiSdk.createSession({
          body: toCreateSessionRequest(input),
          headers: { 'Idempotency-Key': idempotencyKey },
        }),
      );
      return toEntity(data);
    });
  }

  /** A session in a vendor's cloud: the vendor is asked first, and refuses in its own words. */
  startCloud(input: StartCloudSessionInput, idempotencyKey: string): Promise<SessionEntity> {
    return callApi(SessionsErrors.START_CLOUD_FAILED, async (api) => {
      const data = await api.body(
        heyApiSdk.startCloudSession({
          body: toStartCloudSessionRequest(input),
          headers: { 'Idempotency-Key': idempotencyKey },
        }),
      );
      return toEntity(data);
    });
  }

  /**
   * Asks the host to clone or fetch the draft's repository and make a spare
   * worktree, so the create that follows does not wait on git. Answers the
   * hints only: whether the host was told.
   */
  prepare(input: PrepareSessionInput): Promise<string[]> {
    return callApi(SessionsErrors.PREPARE_FAILED, async (api) => {
      const data = await api.body(heyApiSdk.prepareSession({ body: input }));
      return data.hints;
    });
  }

  /**
   * The start of the session's log, up to the entry that says how the start
   * ended, parsed against the schema the runner writes. It walks the log's
   * pages rather than trusting one to hold it: a start is a handful of entries
   * today, and a namer event or a retry is how that stops being true.
   */
  findStartLog(id: string): Promise<SessionStartEntry[]> {
    return callApi(SessionsErrors.FETCH_EVENTS_FAILED, async (api) => {
      const entries: SessionStartEntry[] = [];
      let afterSeq: number | undefined;
      for (let page = 0; page < CONSUMER_CONFIG.sessions.maxStartLogPages; page += 1) {
        const data = await api.body(
          heyApiSdk.findSessionEvents({
            path: { id },
            query: { limit: CONSUMER_CONFIG.sessions.startLogPageSize, afterSeq },
          }),
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
    });
  }

  /** Display only: the slug, the directory and the branch never change. */
  rename(id: string, name: string): Promise<SessionEntity> {
    return callApi(SessionsErrors.RENAME_FAILED, async (api) => {
      const data = await api.body(heyApiSdk.renameSession({ path: { id }, body: { name } }));
      return toEntity(data);
    });
  }

  /** To a project that holds the session's repository; nothing on the host moves. */
  move(id: string, projectId: string): Promise<SessionEntity> {
    return callApi(SessionsErrors.MOVE_FAILED, async (api) => {
      const data = await api.body(heyApiSdk.moveSession({ path: { id }, body: { projectId } }));
      return toEntity(data);
    });
  }

  /**
   * Answer what the session's agent waits on (`decision`), by its id: the API
   * types the keys into its terminal. An id that is no longer the pending one
   * is refused (`SESSIONS_032`), so an answer never lands on the next question.
   */
  answerDecision(id: string, answer: AnswerSessionDecisionDto): Promise<SessionEntity> {
    return callApi(SessionsErrors.ANSWER_DECISION_FAILED, async (api) => {
      const data = await api.body(heyApiSdk.answerSessionDecision({ path: { id }, body: answer }));
      return toEntity(data);
    });
  }

  /**
   * Bring a stopped session's terminal back. The host recreates window 0 in the
   * worktrees the session already has and reopens the agent's own conversation,
   * so what comes back is the session as it was rather than a second one.
   */
  restart(id: string): Promise<SessionEntity> {
    return callApi(SessionsErrors.RESTART_FAILED, async (api) => {
      const data = await api.body(heyApiSdk.restartSession({ path: { id } }));
      return toEntity(data);
    });
  }

  /**
   * Close: the session stops, its worktree leaves the host, and the row stays
   * resolved so its directory name and branch are never reissued. Work that is
   * not pushed refuses the close unless the caller accepts losing it.
   *
   * A close the API took but could not hand to an offline host answers like
   * any other, with `host_offline` in its hints and the close owed on the row:
   * the API sends it again when the host reconnects.
   */
  close(id: string, acceptUnpushedWork = false): Promise<SessionEntity> {
    return callApi(SessionsErrors.CLOSE_FAILED, async (api) => {
      const data = await api.body(
        heyApiSdk.closeSession({
          path: { id },
          query: acceptUnpushedWork ? { acceptUnpushedWork } : undefined,
        }),
      );
      return toEntity(data);
    });
  }

  /**
   * A pass to open one window's terminal. Never cached and never retried on
   * its own: the ticket is single use and sixty seconds.
   */
  issueAttachTicket(
    id: string,
    window = 0,
    target: 'terminal' | 'device' = 'terminal',
  ): Promise<AttachTicket> {
    return callApi(SessionsErrors.ATTACH_TICKET_FAILED, async (api) => {
      const data = await api.body(
        heyApiSdk.issueAttachTicket({
          path: { id },
          body: target === 'device' ? { window, target } : { window },
        }),
      );
      return toTicket(data);
    });
  }

  /** The ports the session listens on, as its host lists them now. */
  findPorts(id: string): Promise<SessionPorts> {
    return callApi(SessionsErrors.PORTS_FAILED, async (api) => {
      const data = await api.body(heyApiSdk.findSessionPorts({ path: { id } }));
      return {
        state: data.state,
        ports: data.ports.map((port) => ({ port: port.port, process: port.process ?? null })),
      };
    });
  }

  /**
   * Where one of the session's ports opens: framed by the Browser tab
   * (`embed`) or in a tab of its own. Never cached: the ticket is single use.
   */
  openPreview(
    id: string,
    preview: { port: number; path?: string; embed: boolean },
  ): Promise<SessionPreview> {
    return callApi(SessionsErrors.PREVIEW_FAILED, async (api) => {
      const data = await api.body(heyApiSdk.issueSessionPreview({ path: { id }, body: preview }));
      return { url: data.url, expiresAt: new Date(data.expiresAt) };
    });
  }

  /** How a session is shared, or `null` when it is not. */
  findShare(id: string): Promise<SessionShare | null> {
    return callApi(SessionsErrors.SHARE_LOAD_FAILED, async (api) => {
      const data = await api.body(heyApiSdk.findSessionShare({ path: { id } }));
      return data.share ? toShare(data.share) : null;
    });
  }

  /** Share a session, or replace how it is shared; its address stays. */
  putShare(id: string, input: PutSessionShareDto): Promise<SessionShare> {
    return callApi(SessionsErrors.SHARE_FAILED, async (api) => {
      const data = await api.body(heyApiSdk.putSessionShare({ path: { id }, body: input }));
      return toShare(data);
    });
  }

  /** The people a `people` share names, nothing else changed. */
  setSharePeople(id: string, people: string[]): Promise<SessionShare> {
    return callApi(SessionsErrors.UPDATE_SHARE_FAILED, async (api) => {
      const data = await api.body(
        heyApiSdk.setSessionSharePeople({ path: { id }, body: { people } }),
      );
      return toShare(data);
    });
  }

  stopShare(id: string): Promise<void> {
    return callApi(SessionsErrors.UPDATE_SHARE_FAILED, async (api) => {
      await api.result(heyApiSdk.stopSessionShare({ path: { id } }));
    });
  }

  /** What a share's address opens for whoever is signed in. */
  findSharedSession(slug: string): Promise<SharedSession> {
    return callApi(SessionsErrors.SHARED_SESSION_FAILED, async (api) => {
      const data = await api.body(heyApiSdk.findSharedSession({ body: { slug } }));
      return {
        name: data.name,
        state: data.state,
        access: data.access,
        sharedBy: data.sharedBy ?? null,
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
      };
    });
  }

  /** A ticket through a share link: never cached, never retried on its own. */
  issueSharedAttachTicket(slug: string): Promise<AttachTicket> {
    return callApi(SessionsErrors.ATTACH_TICKET_FAILED, async (api) => {
      const data = await api.body(heyApiSdk.issueSharedAttachTicket({ body: { slug } }));
      return toTicket(data);
    });
  }

  /**
   * A file (an image, a PDF, text) for a session that does not exist yet:
   * kept briefly by the API for the `create` that names its id in `attachmentIds`. A file over the cap
   * is refused here, before it is sent; the API judges the type by the bytes.
   */
  uploadAttachment(file: Blob): Promise<SessionAttachment> {
    return callApi(SessionsErrors.UPLOAD_ATTACHMENT_FAILED, async (api) => {
      if (file.size > SESSION_FILE_MAX_BYTES) throw new AppError(SessionsErrors.FILE_TOO_LARGE);
      const data = await api.body(heyApiSdk.uploadSessionAttachment({ body: { file: file } }));
      return { id: data.id, mediaType: data.mediaType, size: data.size };
    });
  }

  /**
   * A file for one window's prompt. The agent reads its host's clipboard,
   * not the browser's, so the file goes to the host and the runner pastes
   * its path in. A file over the cap is refused here, before it is sent; the
   * API judges the type by the bytes and answers an unreachable host as an
   * error, so a resolved call means the host has it.
   */
  pasteFile(id: string, file: Blob, window = 0): Promise<void> {
    return callApi(SessionsErrors.PASTE_FILE_FAILED, async (api) => {
      if (file.size > SESSION_FILE_MAX_BYTES) throw new AppError(SessionsErrors.FILE_TOO_LARGE);
      await api.result(heyApiSdk.pasteSessionImage({ path: { id }, body: { file: file, window } }));
    });
  }
}
