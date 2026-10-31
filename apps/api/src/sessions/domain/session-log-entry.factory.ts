import {
  type CloudSessionState,
  type CreateSessionDto,
  placeOfCreate,
  type StartCloudSessionDto,
} from '@oppenheimer/shared';
import { effortLevelFor } from '@oppenheimer/shared/agents';
import { SESSION_FILE_MEDIA_TYPES, type SessionFileMediaType } from '@oppenheimer/shared/protocol';
import { cloudRunLogEntries } from './cloud-session-sync.policy';
import type { CloudRunReport } from './session-cloud-run.entity';
import type { SessionLaunchFile } from './session-launch-file.types';
import {
  type AgentObservedState,
  launchPermissionFor,
  SESSION_EVENT_KINDS,
  type SessionAgent,
  type SessionLaunchFold,
} from './session-state.policy';
import { WorkSessionEntity } from './work-session.entity';
import type { NewSessionEvent } from './work-session-event.entity';

/**
 * The entries the API itself writes to a session's log: what a create request
 * owes it, what a cloud vendor's answer owes it, and what the extension's report
 * owes it. They are the session's facts (the fold projects them into its
 * columns), so they are built here, beside the rules that read them, and the
 * repository only appends what it is handed.
 */

/**
 * What the extension saw a cloud session doing on claude.ai, in the observed
 * vocabulary a runner's screen reading uses, so its dot is drawn by the same
 * rules as any other (`session-group.policy.ts`). A failed turn waits on the
 * person as a question does; a finished one is ready for a prompt.
 */
const CLOUD_OBSERVED: Record<CloudSessionState, AgentObservedState> = {
  running: 'working',
  'needs-input': 'blocked',
  failed: 'blocked',
  done: 'done',
  stopped: 'done',
};

export function cloudObservedState(cloudState: CloudSessionState): AgentObservedState {
  return CLOUD_OBSERVED[cloudState];
}

/** The extension's report as the log's `agent.observed`, keyed to its command and session. */
export function cloudObservedEntry(
  commandId: string,
  session: WorkSessionEntity,
  cloudState: CloudSessionState,
): NewSessionEvent {
  return {
    idempotencyKey: WorkSessionEntity.apiIdempotencyKey(
      `${commandId}:${session.id}`,
      SESSION_EVENT_KINDS.AGENT_OBSERVED,
    ),
    source: 'api',
    kind: SESSION_EVENT_KINDS.AGENT_OBSERVED,
    payload: { state: cloudObservedState(cloudState), cloudState },
  };
}

/**
 * The entries a create request owes its log: one action, one transaction.
 *
 * At most three. `session.requested` states the launch, which the launch columns
 * project, and for a folder session the folder. `session.cwd_set` is an entry,
 * not a column write, because a later "work in this checkout instead" is the same
 * entry; a folder session has no checkout to work in, so it gets none.
 * `prompt.first` carries the composer's task, and is absent rather than empty
 * when there was none.
 */
export function requestEntries(props: {
  commandId: string;
  userId: string;
  input: CreateSessionDto;
  /** The first task's images, already parked for the host. */
  images?: readonly SessionLaunchFile[];
  checkouts: number;
  cwdCheckoutId: string | null;
}): NewSessionEvent[] {
  const { input } = props;
  const key = (kind: string) => WorkSessionEntity.apiIdempotencyKey(props.commandId, kind);
  const events: NewSessionEvent[] = [
    {
      idempotencyKey: key(SESSION_EVENT_KINDS.REQUESTED),
      source: 'api',
      kind: SESSION_EVENT_KINDS.REQUESTED,
      payload: {
        agent: input.agent,
        hostId: input.hostId,
        checkouts: props.checkouts,
        place: placeOfCreate(input),
        ...(input.folder ? { folder: input.folder } : {}),
        requestedByUserId: props.userId,
        launch: launchOf(input.agent, input.launch),
      },
    },
  ];
  if (!input.folder) {
    events.push({
      idempotencyKey: key(SESSION_EVENT_KINDS.CWD_SET),
      source: 'api',
      kind: SESSION_EVENT_KINDS.CWD_SET,
      payload: { checkoutId: props.cwdCheckoutId },
    });
  }
  if (input.prompt) {
    events.push({
      idempotencyKey: firstPromptKey(props.commandId),
      source: 'api',
      kind: SESSION_EVENT_KINDS.PROMPT_FIRST,
      payload: {
        text: input.prompt,
        ...(props.images?.length ? { images: props.images.map(toFileRecord) } : {}),
      },
    });
  }
  return events;
}

/**
 * A cloud session's first entries: the request, as a host session's says it
 * (no host, the place `cloud`), and the first task. The vendor's first answer
 * follows as entries of its own (`cloudRunEntries`).
 */
export function cloudRequestEntries(props: {
  commandId: string;
  userId: string;
  agent: SessionAgent;
  input: StartCloudSessionDto;
}): NewSessionEvent[] {
  const key = (kind: string) => WorkSessionEntity.apiIdempotencyKey(props.commandId, kind);
  return [
    {
      idempotencyKey: key(SESSION_EVENT_KINDS.REQUESTED),
      source: 'api',
      kind: SESSION_EVENT_KINDS.REQUESTED,
      payload: {
        agent: props.agent,
        provider: props.input.provider,
        place: 'cloud',
        requestedByUserId: props.userId,
        launch: launchOf(props.agent, { model: props.input.model }),
      },
    },
    {
      idempotencyKey: firstPromptKey(props.commandId),
      source: 'api',
      kind: SESSION_EVENT_KINDS.PROMPT_FIRST,
      payload: { text: props.input.prompt },
    },
  ];
}

/** The entries a vendor's report owes the log (`cloudRunLogEntries`), as the API writes them. */
export function cloudRunEntries(report: CloudRunReport, now: Date): NewSessionEvent[] {
  return cloudRunLogEntries(report.runId, report.status).map((entry) => ({
    ...entry,
    source: 'api',
    occurredAt: now,
  }));
}

/**
 * The launch a request states, with the absences filled in.
 *
 * An absent level is `ask` — the one that asks before every action — and never
 * anything else: a default that escalated is the single mistake this field must
 * not make (`product/versions/mvp/03-control-plane.md`). An agent with no
 * approvals records no level at all (`launchPermissionFor`), and an effort
 * the model does not offer is not recorded (`effortLevelFor`).
 */
export function launchOf(
  agent: SessionAgent,
  launch: CreateSessionDto['launch'],
): SessionLaunchFold {
  return {
    model: launch?.model ?? null,
    permission: launchPermissionFor(agent, launch?.permission),
    effort: effortLevelFor(agent, launch?.model ?? null, launch?.effort),
  };
}

/**
 * What keys the `prompt.first` entry of a create request — and therefore the
 * name derived from it, so the title is keyed on the prompt that caused it.
 */
export function firstPromptKey(commandId: string): string {
  return WorkSessionEntity.apiIdempotencyKey(commandId, SESSION_EVENT_KINDS.PROMPT_FIRST);
}

/**
 * The images a `prompt.first` entry names, for a create sent again. An entry
 * written before images existed, or one a runner wrote off the transcript,
 * names none; a malformed item is dropped rather than sent to a host.
 */
export function firstPromptFilesOf(payload: unknown): SessionLaunchFile[] {
  const listed = (payload as { images?: unknown } | null)?.images;
  if (!Array.isArray(listed)) return [];
  return listed.flatMap((item: { imageId?: unknown; mediaType?: unknown }) =>
    typeof item?.imageId === 'string' &&
    (SESSION_FILE_MEDIA_TYPES as readonly unknown[]).includes(item.mediaType)
      ? [{ imageId: item.imageId, mediaType: item.mediaType as SessionFileMediaType }]
      : [],
  );
}

function toFileRecord(image: SessionLaunchFile): SessionLaunchFile {
  return { imageId: image.imageId, mediaType: image.mediaType };
}
