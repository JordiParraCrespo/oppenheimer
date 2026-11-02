import { ArgumentInvalidException, type CreateEntityProps, Entity } from '@oppenheimer/backend-ddd';
import {
  CLOUD_AGENT_STATUSES,
  type CloudAgentProviderId,
  type CloudAgentStatus,
  cloudAgentIsActive,
} from '@oppenheimer/shared';

/** What a vendor says about a cloud session's latest run. */
export interface CloudRunReport {
  runId: string;
  status: CloudAgentStatus;
  /** The branch the agent pushed, once it pushed one. */
  branch: string | null;
  pullRequestUrl: string | null;
  /** The agent's last reply, once the run ended. */
  summary: string | null;
}

export interface SessionCloudRunProps extends Omit<CloudRunReport, 'runId'> {
  organizationId: string;
  provider: CloudAgentProviderId;
  /** The vendor's id for the agent (Cursor's `bc-<sessionId>`). */
  externalId: string;
  /** The agent's own page at the vendor, which the session's row opens. */
  url: string | null;
  repositoryUrl: string;
  latestRunId: string;
  /** When the vendor was last asked about the run. */
  syncedAt: Date;
}

/** A launch the vendor accepted: its agent, its page and its first run. */
export interface LaunchedCloudRun {
  organizationId: string;
  sessionId: string;
  provider: CloudAgentProviderId;
  externalId: string;
  url: string | null;
  repositoryUrl: string;
  run: CloudRunReport;
}

/**
 * The vendor's half of a cloud session, a member of the session's aggregate
 * keyed by the session's id (`session_cloud_run`). The session's state is the
 * fold of its log; this is what the vendor last said, kept so the next read
 * knows what to ask about and the row can show the branch and pull request.
 */
export class SessionCloudRunEntity extends Entity<SessionCloudRunProps> {
  static create(create: CreateEntityProps<SessionCloudRunProps>): SessionCloudRunEntity {
    return new SessionCloudRunEntity(create);
  }

  static launched(launch: LaunchedCloudRun, now: Date): SessionCloudRunEntity {
    const { runId, ...run } = launch.run;
    return new SessionCloudRunEntity({
      id: launch.sessionId,
      props: {
        organizationId: launch.organizationId,
        provider: launch.provider,
        externalId: launch.externalId,
        url: launch.url,
        repositoryUrl: launch.repositoryUrl,
        latestRunId: runId,
        ...run,
        syncedAt: now,
      },
    });
  }

  get sessionId(): string {
    return this.id;
  }
  get organizationId(): string {
    return this.props.organizationId;
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
  get repositoryUrl(): string {
    return this.props.repositoryUrl;
  }
  get latestRunId(): string {
    return this.props.latestRunId;
  }
  get status(): CloudAgentStatus {
    return this.props.status;
  }
  get isActive(): boolean {
    return cloudAgentIsActive(this.props.status);
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
   * What the vendor said about the latest run. A branch or a pull request,
   * once known, is kept when an answer omits it. An answer about another run
   * is not this one's, and is ignored.
   */
  synced(report: CloudRunReport, now: Date): void {
    if (report.runId !== this.props.latestRunId) return;
    this.props.status = report.status;
    this.props.branch = report.branch ?? this.props.branch;
    this.props.pullRequestUrl = report.pullRequestUrl ?? this.props.pullRequestUrl;
    this.props.summary = report.summary;
    this.props.syncedAt = now;
  }

  public validate(): void {
    if (!CLOUD_AGENT_STATUSES.includes(this.props.status)) {
      throw new ArgumentInvalidException(`Unknown cloud run status: ${this.props.status}`);
    }
  }
}
