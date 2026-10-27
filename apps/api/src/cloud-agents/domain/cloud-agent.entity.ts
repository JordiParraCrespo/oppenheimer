import { randomUUID } from 'node:crypto';
import {
  AggregateRoot,
  ArgumentInvalidException,
  type CreateEntityProps,
} from '@oppenheimer/backend-ddd';
import {
  CLOUD_AGENT_STATUSES,
  type CloudAgentProviderId,
  type CloudAgentStatus,
  cloudAgentIsActive,
} from '@oppenheimer/shared';

/** What a vendor says about an agent and its latest run. */
export interface CloudAgentRunState {
  runId: string;
  status: CloudAgentStatus;
  /** The branch the agent pushed, once it pushed one. */
  branch: string | null;
  pullRequestUrl: string | null;
  /** The agent's last reply, once the run ended. */
  summary: string | null;
}

export interface CloudAgentProps extends Omit<CloudAgentRunState, 'runId'> {
  organizationId: string;
  createdByUserId: string;
  provider: CloudAgentProviderId;
  /** The vendor's id for the agent (Cursor's `bc-…`). */
  externalId: string;
  /** The agent's own page at the vendor. */
  url: string | null;
  name: string;
  /** The prompt it was launched with. */
  prompt: string;
  repositoryUrl: string;
  startingRef: string | null;
  /** Null is the vendor's default model. */
  model: string | null;
  autoCreatePr: boolean;
  latestRunId: string;
  /** When the vendor was last asked about the run. */
  syncedAt: Date;
}

/** What a launch asks the vendor for, and gets back. */
export interface LaunchedCloudAgentProps
  extends Pick<
    CloudAgentProps,
    | 'organizationId'
    | 'createdByUserId'
    | 'provider'
    | 'prompt'
    | 'repositoryUrl'
    | 'startingRef'
    | 'model'
    | 'autoCreatePr'
  > {
  id: string;
  externalId: string;
  url: string | null;
  name: string;
  run: CloudAgentRunState;
}

/**
 * A coding agent running in a vendor's cloud, launched from the console
 * (`product/next-steps/cloud-agents.md`). The vendor holds the agent; this
 * row is what we launched, for whom, and what the vendor last said about its
 * latest run, so a list is read without asking the vendor about every row.
 *
 * Its state is the vendor's, copied by `sync`. A follow-up and a stop change
 * it here at once, ahead of the vendor's own answer, so the console does not
 * show a stopped run as working until the next sync.
 */
export class CloudAgentEntity extends AggregateRoot<CloudAgentProps> {
  static create(create: CreateEntityProps<CloudAgentProps>): CloudAgentEntity {
    return new CloudAgentEntity(create);
  }

  /** The id an agent is given before the vendor is asked, so a retried launch can name it. */
  static newId(): string {
    return randomUUID();
  }

  static launched(props: LaunchedCloudAgentProps, now: Date): CloudAgentEntity {
    const { id, run, ...rest } = props;
    return new CloudAgentEntity({
      id,
      props: {
        ...rest,
        status: run.status,
        latestRunId: run.runId,
        branch: run.branch,
        pullRequestUrl: run.pullRequestUrl,
        summary: run.summary,
        syncedAt: now,
      },
    });
  }

  get organizationId(): string {
    return this.props.organizationId;
  }
  get createdByUserId(): string {
    return this.props.createdByUserId;
  }
  get provider(): CloudAgentProviderId {
    return this.props.provider;
  }
  get externalId(): string {
    return this.props.externalId;
  }
  get url(): string | null {
    return this.props.url;
  }
  get name(): string {
    return this.props.name;
  }
  get prompt(): string {
    return this.props.prompt;
  }
  get repositoryUrl(): string {
    return this.props.repositoryUrl;
  }
  get startingRef(): string | null {
    return this.props.startingRef;
  }
  get model(): string | null {
    return this.props.model;
  }
  get autoCreatePr(): boolean {
    return this.props.autoCreatePr;
  }
  get status(): CloudAgentStatus {
    return this.props.status;
  }
  get isActive(): boolean {
    return cloudAgentIsActive(this.props.status);
  }
  get latestRunId(): string {
    return this.props.latestRunId;
  }
  get branch(): string | null {
    return this.props.branch;
  }
  get pullRequestUrl(): string | null {
    return this.props.pullRequestUrl;
  }
  get summary(): string | null {
    return this.props.summary;
  }
  get syncedAt(): Date {
    return this.props.syncedAt;
  }

  /**
   * The vendor's answer about a run. An answer about a run older than the
   * latest is ignored: a sync that left before a follow-up must not undo it.
   * A branch or a pull request, once known, is kept when an answer omits it.
   */
  sync(run: CloudAgentRunState, now: Date): void {
    if (run.runId !== this.props.latestRunId) return;
    this.props.status = run.status;
    this.props.branch = run.branch ?? this.props.branch;
    this.props.pullRequestUrl = run.pullRequestUrl ?? this.props.pullRequestUrl;
    this.props.summary = run.summary;
    this.props.syncedAt = now;
    this.setUpdatedAt(now);
  }

  /** A follow-up started `runId`: the agent is working again, on what the vendor says next. */
  followedUp(runId: string, now: Date): void {
    this.props.latestRunId = runId;
    this.props.status = 'starting';
    this.props.summary = null;
    this.props.syncedAt = now;
    this.setUpdatedAt(now);
  }

  /** The vendor accepted a stop of the latest run. */
  cancelled(now: Date): void {
    this.props.status = 'cancelled';
    this.props.syncedAt = now;
    this.setUpdatedAt(now);
  }

  public validate(): void {
    if (!CLOUD_AGENT_STATUSES.includes(this.props.status)) {
      throw new ArgumentInvalidException(`Unknown cloud agent status: ${this.props.status}`);
    }
  }
}
