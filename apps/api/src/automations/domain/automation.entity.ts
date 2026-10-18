import { randomUUID } from 'node:crypto';
import {
  AggregateRoot,
  ArgumentInvalidException,
  ArgumentNotProvidedException,
  type CreateEntityProps,
} from '@oppenheimer/backend-ddd';
import type { Scope } from '@oppenheimer/shared';
import { effortLevelFor } from '@oppenheimer/shared/agents';
import type {
  AutomationOverlapPolicy,
  AutomationPausedReason,
} from '@oppenheimer/shared/automations';
import type {
  AutomationRevisionProps,
  AutomationRunTargetKind,
  AutomationTriggerProps,
  SessionRevisionProps,
} from './automation.types';
import { nextFireOf } from './trigger-config.policy';

export interface AutomationProps {
  organizationId: string;
  /** Null only for a bot routine, which belongs to no project. */
  projectId: string | null;
  /** What its runs start; fixed for the automation's life. */
  runTarget: AutomationRunTargetKind;
  /** The bot a routine wakes; set exactly when `runTarget` is `bot`. */
  botId: string | null;
  /** The scopes of the credential that saved it; null for a browser session. */
  credentialScopes: readonly Scope[] | null;
  /** Whose runs these are: every run acts as this person (§Q5). */
  ownerUserId: string;
  name: string;
  /** What a run executes now. A change to it is the next revision, never an edit. */
  revision: AutomationRevisionProps;
  /** In the editor's order. Replaced whole on a save. */
  triggers: AutomationTriggerProps[];
  pausedAt: Date | null;
  pausedReason: AutomationPausedReason | null;
  deletedAt: Date | null;
  overlap: AutomationOverlapPolicy | null;
  maxRunsPerHour: number | null;
  version: number;
}

/** What a session automation's run executes, as a caller states it: the next revision's fields. */
export type RevisionInput = Omit<SessionRevisionProps, 'id' | 'number' | 'createdAt' | 'kind'>;

export interface CreateAutomationProps {
  organizationId: string;
  projectId: string;
  ownerUserId: string;
  name: string;
  revision: RevisionInput;
  triggers: AutomationTriggerProps[];
  active: boolean;
  overlap?: AutomationOverlapPolicy | null;
  maxRunsPerHour?: number | null;
  now: Date;
}

/** A bot routine as its bot saves it (`26-bot-routines.md` §4): a prompt and when. */
export interface CreateRoutineProps {
  organizationId: string;
  ownerUserId: string;
  botId: string;
  name: string;
  prompt: string;
  triggers: AutomationTriggerProps[];
  active: boolean;
  credentialScopes: readonly Scope[] | null;
  now: Date;
}

export interface AutomationChanges {
  name?: string;
  projectId?: string;
  revision?: Partial<RevisionInput>;
  triggers?: AutomationTriggerProps[];
  overlap?: AutomationOverlapPolicy | null;
  maxRunsPerHour?: number | null;
  /** The scopes of the credential that saved what runs; a routine's runs keep within them. */
  credentialScopes?: readonly Scope[] | null;
}

const REVISION_FIELDS = [
  'hostId',
  'agent',
  'model',
  'permission',
  'effort',
  'prompt',
] as const satisfies readonly (keyof RevisionInput)[];

/**
 * Automation aggregate root — a saved prompt, where it runs, and the triggers
 * that start it (`product/versions/mvp/16-automations-architecture.md`).
 *
 * Two parts with different lifecycles: the **root** (name, project, owner,
 * pause, triggers, limits) is edited in place, and the **revision** (what a run
 * executes) is immutable — changing the prompt, the host, the agent, the model,
 * the permission, the effort or the repositories creates the next revision, so
 * every run can say exactly what it ran.
 *
 * Pausing or deleting stops the schedule by clearing every trigger's
 * `nextFireAt`, which is what the scheduler claims by; resuming computes it
 * again from now, so a paused week does not fire a burst of missed slots.
 */
export class AutomationEntity extends AggregateRoot<AutomationProps> {
  /** Whether the last change created a revision the repository has to insert. */
  private revised = false;

  static create(create: CreateEntityProps<AutomationProps>): AutomationEntity {
    return new AutomationEntity(create);
  }

  static createNew(props: CreateAutomationProps): AutomationEntity {
    const entity = new AutomationEntity({
      id: randomUUID(),
      props: {
        organizationId: props.organizationId,
        projectId: props.projectId,
        runTarget: 'session',
        botId: null,
        credentialScopes: null,
        ownerUserId: props.ownerUserId,
        name: props.name.trim(),
        revision: {
          ...props.revision,
          kind: 'session',
          effort: effortLevelFor(props.revision.agent, props.revision.model, props.revision.effort),
          id: randomUUID(),
          number: 1,
          createdAt: props.now,
        },
        triggers: props.triggers,
        pausedAt: props.active ? null : props.now,
        pausedReason: props.active ? null : 'user',
        deletedAt: null,
        overlap: props.overlap ?? null,
        maxRunsPerHour: props.maxRunsPerHour ?? null,
        version: 1,
      },
    });
    entity.revised = true;
    entity.schedule(props.now);
    entity.validate();
    return entity;
  }

  /** A routine its bot saved (`26-bot-routines.md` §3): no project, no host. */
  static createRoutine(props: CreateRoutineProps): AutomationEntity {
    const entity = new AutomationEntity({
      id: randomUUID(),
      props: {
        organizationId: props.organizationId,
        projectId: null,
        runTarget: 'bot',
        botId: props.botId,
        credentialScopes: props.credentialScopes,
        ownerUserId: props.ownerUserId,
        name: props.name.trim(),
        revision: {
          kind: 'bot',
          prompt: props.prompt,
          id: randomUUID(),
          number: 1,
          createdByUserId: props.ownerUserId,
          createdAt: props.now,
        },
        triggers: props.triggers,
        pausedAt: props.active ? null : props.now,
        pausedReason: props.active ? null : 'user',
        deletedAt: null,
        overlap: null,
        maxRunsPerHour: null,
        version: 1,
      },
    });
    entity.revised = true;
    entity.schedule(props.now);
    entity.validate();
    return entity;
  }

  get organizationId(): string {
    return this.props.organizationId;
  }
  get projectId(): string | null {
    return this.props.projectId;
  }
  get botId(): string | null {
    return this.props.botId;
  }
  get credentialScopes(): readonly Scope[] | null {
    return this.props.credentialScopes;
  }
  get ownerUserId(): string {
    return this.props.ownerUserId;
  }
  get name(): string {
    return this.props.name;
  }
  get revision(): AutomationRevisionProps {
    return this.props.revision;
  }
  get runTarget(): AutomationRunTargetKind {
    return this.props.runTarget;
  }
  /**
   * The revision of a session automation. The paths that read it (the editor,
   * the console's listings, the session target) only ever hold one, so a bot
   * routine here is a bug, not a refusal.
   */
  get sessionRevision(): SessionRevisionProps {
    const revision = this.props.revision;
    if (revision.kind !== 'session') {
      throw new ArgumentInvalidException(`Automation ${this.id} is a bot routine, not a session's`);
    }
    return revision;
  }
  /** The project of a session automation, which always has one. */
  get sessionProjectId(): string {
    if (this.props.projectId === null) {
      throw new ArgumentInvalidException(`Automation ${this.id} belongs to no project`);
    }
    return this.props.projectId;
  }
  get triggers(): readonly AutomationTriggerProps[] {
    return this.props.triggers;
  }
  get pausedAt(): Date | null {
    return this.props.pausedAt;
  }
  get pausedReason(): AutomationPausedReason | null {
    return this.props.pausedReason;
  }
  get deletedAt(): Date | null {
    return this.props.deletedAt;
  }
  get overlap(): AutomationOverlapPolicy | null {
    return this.props.overlap;
  }
  get maxRunsPerHour(): number | null {
    return this.props.maxRunsPerHour;
  }
  get version(): number {
    return this.props.version;
  }
  get isPaused(): boolean {
    return this.props.pausedAt !== null;
  }
  get isDeleted(): boolean {
    return this.props.deletedAt !== null;
  }
  get hasNewRevision(): boolean {
    return this.revised;
  }

  /**
   * Apply an editor save. A change to anything a run executes becomes the next
   * revision; everything else is edited in place. Triggers are replaced whole,
   * because the editor holds the whole list.
   */
  change(changes: AutomationChanges, by: string, now: Date): void {
    this.assertLive();
    if (changes.name !== undefined) this.props.name = changes.name.trim();
    if (changes.projectId !== undefined) this.props.projectId = changes.projectId;
    if (changes.overlap !== undefined) this.props.overlap = changes.overlap;
    if (changes.maxRunsPerHour !== undefined) this.props.maxRunsPerHour = changes.maxRunsPerHour;
    if (changes.credentialScopes !== undefined) {
      this.props.credentialScopes = changes.credentialScopes;
    }
    if (changes.revision && this.revisionDiffers(changes.revision)) {
      this.props.revision = this.nextRevision(changes.revision, by, now);
      this.revised = true;
    }
    if (changes.triggers !== undefined) {
      this.props.triggers = changes.triggers;
      this.schedule(now);
    }
    this.touch();
  }

  pause(reason: AutomationPausedReason, now: Date): void {
    this.assertLive();
    if (this.isPaused && this.props.pausedReason === reason) return;
    this.props.pausedAt = this.props.pausedAt ?? now;
    this.props.pausedReason = reason;
    this.schedule(now);
    this.touch();
  }

  resume(now: Date): void {
    this.assertLive();
    if (!this.isPaused) return;
    this.props.pausedAt = null;
    this.props.pausedReason = null;
    this.schedule(now);
    this.touch();
  }

  /** A tombstone: the triggers stop now, and the runs are kept. Idempotent. */
  delete(now: Date): void {
    if (this.isDeleted) return;
    this.props.deletedAt = now;
    this.schedule(now);
    this.touch();
  }

  /** The earliest time a schedule trigger fires next, or null when none will. */
  nextRunAt(): Date | null {
    let earliest: Date | null = null;
    for (const trigger of this.props.triggers) {
      if (trigger.nextFireAt && (!earliest || trigger.nextFireAt < earliest)) {
        earliest = trigger.nextFireAt;
      }
    }
    return earliest;
  }

  /** Recompute every schedule trigger's next slot, or clear it while paused or deleted. */
  private schedule(now: Date): void {
    const firing = !this.isPaused && !this.isDeleted;
    this.props.triggers = this.props.triggers.map((trigger) =>
      trigger.source === 'schedule'
        ? { ...trigger, nextFireAt: firing ? nextFireOf(trigger, now) : null }
        : trigger,
    );
  }

  private nextRevision(
    changes: Partial<RevisionInput>,
    by: string,
    now: Date,
  ): AutomationRevisionProps {
    const current = this.props.revision;
    const numbered = {
      id: randomUUID(),
      number: current.number + 1,
      createdByUserId: by,
      createdAt: now,
    };
    if (current.kind === 'bot') {
      // A routine's revision is its prompt; where and how it runs is its bot's.
      return { kind: 'bot', prompt: changes.prompt ?? current.prompt, ...numbered };
    }
    // The effort is judged on the whole next revision, since an edit can
    // change the agent or the model without touching it (`effortLevelFor`).
    const next = { ...current, ...changes };
    return { ...next, effort: effortLevelFor(next.agent, next.model, next.effort), ...numbered };
  }

  private revisionDiffers(next: Partial<RevisionInput>): boolean {
    const current = this.props.revision;
    if (current.kind === 'bot') {
      return next.prompt !== undefined && next.prompt !== current.prompt;
    }
    for (const field of REVISION_FIELDS) {
      if (next[field] !== undefined && next[field] !== current[field]) return true;
    }
    if (next.repositories !== undefined) {
      const key = (list: RevisionInput['repositories']) =>
        // The pair a session's checkout sends: a rotated installation is a
        // different checkout of the same repository.
        list
          .map((repository) => `${repository.installationId}:${repository.githubRepoId}`)
          .join(',');
      if (key(next.repositories) !== key(current.repositories)) return true;
    }
    return false;
  }

  private assertLive(): void {
    if (this.isDeleted) throw new ArgumentInvalidException('A deleted automation cannot change');
  }

  private touch(): void {
    this.setUpdatedAt(new Date());
    this.validate();
  }

  public validate(): void {
    if (!this.props.organizationId) {
      throw new ArgumentNotProvidedException('An automation belongs to a workspace');
    }
    if (!this.props.name?.trim()) {
      throw new ArgumentNotProvidedException('An automation needs a name');
    }
    if (!this.props.revision.prompt?.trim()) {
      throw new ArgumentNotProvidedException('An automation needs instructions');
    }
    if (!this.isDeleted && this.props.triggers.length === 0) {
      throw new ArgumentInvalidException('Any trigger starts a run, and there is none');
    }
    const revision = this.props.revision;
    if ((this.props.runTarget === 'bot') !== (revision.kind === 'bot')) {
      throw new ArgumentInvalidException('A revision is of the kind its automation runs');
    }
    if (revision.kind === 'bot') {
      if (!this.props.botId) throw new ArgumentNotProvidedException('A routine belongs to a bot');
      return;
    }
    if (!this.props.projectId) {
      throw new ArgumentNotProvidedException('A session automation belongs to a project');
    }
    if (revision.repositories.length === 0) {
      throw new ArgumentInvalidException('An automation works in at least one repository');
    }
    const repositories = new Set(
      revision.repositories.map((repository) => repository.githubRepoId),
    );
    for (const trigger of this.props.triggers) {
      if (trigger.source === 'schedule') continue;
      if (!trigger.config.repositories.every((id) => repositories.has(id))) {
        throw new ArgumentInvalidException(
          'A trigger listens on a repository the automation does not work in',
        );
      }
    }
  }
}
