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
  AutomationChange,
  AutomationRevisionProps,
  AutomationRunTargetKind,
  AutomationTarget,
  AutomationTriggerProps,
  SessionRevisionProps,
} from './automation.types';
import { nextFireOf } from './trigger-config.policy';

export interface AutomationProps {
  organizationId: string;
  /** What its runs start, and what only that kind has; fixed for the automation's life. */
  target: AutomationTarget;
  /** Whose runs these are: every run acts as this person (§Q5). */
  ownerUserId: string;
  name: string;
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

/** An edit of what every automation has: its name, its triggers and its limits. */
export interface AutomationChanges {
  name?: string;
  triggers?: AutomationTriggerProps[];
  overlap?: AutomationOverlapPolicy | null;
  maxRunsPerHour?: number | null;
}

/** An edit of a session automation's own part: its project and what a run executes. */
export interface SessionChanges {
  projectId?: string;
  revision?: Partial<RevisionInput>;
}

/** An edit of a routine's own part: its prompt, and the scopes of the credential behind it. */
export interface RoutineChanges {
  prompt?: string;
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
  /** What this instance changed since it was last saved, in the order it did. */
  private readonly unsaved = new Set<AutomationChange>();

  static create(create: CreateEntityProps<AutomationProps>): AutomationEntity {
    return new AutomationEntity(create);
  }

  static createNew(props: CreateAutomationProps): AutomationEntity {
    const entity = new AutomationEntity({
      id: randomUUID(),
      props: {
        organizationId: props.organizationId,
        target: {
          kind: 'session',
          projectId: props.projectId,
          revision: {
            ...props.revision,
            kind: 'session',
            effort: effortLevelFor(
              props.revision.agent,
              props.revision.model,
              props.revision.effort,
            ),
            id: randomUUID(),
            number: 1,
            createdAt: props.now,
          },
        },
        ownerUserId: props.ownerUserId,
        name: props.name.trim(),
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
    entity.unsaved.add('created');
    return entity;
  }

  /** A routine its bot saved (`26-bot-routines.md` §3): no project, no host. */
  static createRoutine(props: CreateRoutineProps): AutomationEntity {
    const entity = new AutomationEntity({
      id: randomUUID(),
      props: {
        organizationId: props.organizationId,
        target: {
          kind: 'bot',
          botId: props.botId,
          credentialScopes: props.credentialScopes,
          revision: {
            kind: 'bot',
            prompt: props.prompt,
            id: randomUUID(),
            number: 1,
            createdByUserId: props.ownerUserId,
            createdAt: props.now,
          },
        },
        ownerUserId: props.ownerUserId,
        name: props.name.trim(),
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
    entity.unsaved.add('created');
    return entity;
  }

  get organizationId(): string {
    return this.props.organizationId;
  }
  get ownerUserId(): string {
    return this.props.ownerUserId;
  }
  get name(): string {
    return this.props.name;
  }
  /** What its runs start; narrow on `kind` for the project, the bot or the revision's details. */
  get target(): AutomationTarget {
    return this.props.target;
  }
  get runTarget(): AutomationRunTargetKind {
    return this.props.target.kind;
  }
  /** Whether this is a routine of that bot; anything else is not that bot's to touch. */
  isRoutineOf(botId: string): boolean {
    const { target } = this.props;
    return target.kind === 'bot' && target.botId === botId;
  }
  /** The current revision, whichever kind: its number and prompt are every revision's. */
  get revision(): AutomationRevisionProps {
    return this.props.target.revision;
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
  /** What changed since the last save: created, edited, paused, resumed or deleted. */
  get changes(): ReadonlySet<AutomationChange> {
    return this.unsaved;
  }

  /** Saved: its events are staged and its changes are no longer news. */
  override clearEvents(): void {
    super.clearEvents();
    this.unsaved.clear();
  }

  /** Edit what every automation has. Triggers are replaced whole, because the editor holds them all. */
  change(changes: AutomationChanges, now: Date): void {
    this.assertLive();
    const renamed = changes.name !== undefined && changes.name.trim() !== this.props.name;
    if (changes.name !== undefined) this.props.name = changes.name.trim();
    if (changes.overlap !== undefined) this.props.overlap = changes.overlap;
    if (changes.maxRunsPerHour !== undefined) this.props.maxRunsPerHour = changes.maxRunsPerHour;
    if (changes.triggers !== undefined) {
      this.props.triggers = changes.triggers;
      this.schedule(now);
    }
    if (renamed || changes.triggers !== undefined) this.unsaved.add('edited');
    this.touch();
  }

  /**
   * Edit a session automation's own part. A change to anything a run
   * executes is the next revision; the project is edited in place.
   */
  reviseSession(changes: SessionChanges, by: string, now: Date): void {
    this.assertLive();
    const target = this.props.target;
    if (target.kind !== 'session') {
      throw new ArgumentInvalidException(`Automation ${this.id} is a routine, not a session's`);
    }
    const revision =
      changes.revision && sessionRevisionDiffers(target.revision, changes.revision)
        ? nextSessionRevision(target.revision, changes.revision, by, now)
        : target.revision;
    this.revised = this.revised || revision !== target.revision;
    this.props.target = { ...target, projectId: changes.projectId ?? target.projectId, revision };
    this.touch();
  }

  /**
   * Edit a routine's own part: a new prompt is its next revision, and the
   * scopes are those of the credential behind the edit.
   */
  reviseRoutine(changes: RoutineChanges, by: string, now: Date): void {
    this.assertLive();
    const target = this.props.target;
    if (target.kind !== 'bot') {
      throw new ArgumentInvalidException(`Automation ${this.id} is a session's, not a routine`);
    }
    const revision =
      changes.prompt !== undefined && changes.prompt !== target.revision.prompt
        ? {
            kind: 'bot' as const,
            prompt: changes.prompt,
            id: randomUUID(),
            number: target.revision.number + 1,
            createdByUserId: by,
            createdAt: now,
          }
        : target.revision;
    this.revised = this.revised || revision !== target.revision;
    if (revision !== target.revision) this.unsaved.add('edited');
    this.props.target = {
      ...target,
      credentialScopes:
        changes.credentialScopes === undefined ? target.credentialScopes : changes.credentialScopes,
      revision,
    };
    this.touch();
  }

  pause(reason: AutomationPausedReason, now: Date): void {
    this.assertLive();
    if (this.isPaused && this.props.pausedReason === reason) return;
    this.props.pausedAt = this.props.pausedAt ?? now;
    this.props.pausedReason = reason;
    this.schedule(now);
    this.unsaved.add('paused');
    this.touch();
  }

  resume(now: Date): void {
    this.assertLive();
    if (!this.isPaused) return;
    this.props.pausedAt = null;
    this.props.pausedReason = null;
    this.schedule(now);
    this.unsaved.add('resumed');
    this.touch();
  }

  /** A tombstone: the triggers stop now, and the runs are kept. Idempotent. */
  delete(now: Date): void {
    if (this.isDeleted) return;
    this.props.deletedAt = now;
    this.schedule(now);
    this.unsaved.add('deleted');
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
    const { target } = this.props;
    if (!target.revision.prompt?.trim()) {
      throw new ArgumentNotProvidedException('An automation needs instructions');
    }
    if (!this.isDeleted && this.props.triggers.length === 0) {
      throw new ArgumentInvalidException('Any trigger starts a run, and there is none');
    }
    if (target.kind === 'bot') {
      if (!target.botId) throw new ArgumentNotProvidedException('A routine belongs to a bot');
      return;
    }
    if (!target.projectId) {
      throw new ArgumentNotProvidedException('A session automation belongs to a project');
    }
    const revision = target.revision;
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

/**
 * A session automation's next revision. The effort is judged on the whole
 * next revision, since an edit can change the agent or the model without
 * touching it (`effortLevelFor`).
 */
function nextSessionRevision(
  current: SessionRevisionProps,
  changes: Partial<RevisionInput>,
  by: string,
  now: Date,
): SessionRevisionProps {
  const next = { ...current, ...changes };
  return {
    ...next,
    effort: effortLevelFor(next.agent, next.model, next.effort),
    id: randomUUID(),
    number: current.number + 1,
    createdByUserId: by,
    createdAt: now,
  };
}

function sessionRevisionDiffers(
  current: SessionRevisionProps,
  next: Partial<RevisionInput>,
): boolean {
  for (const field of REVISION_FIELDS) {
    if (next[field] !== undefined && next[field] !== current[field]) return true;
  }
  if (next.repositories !== undefined) {
    const key = (list: RevisionInput['repositories']) =>
      // The pair a session's checkout sends: a rotated installation is a
      // different checkout of the same repository.
      list.map((repository) => `${repository.installationId}:${repository.githubRepoId}`).join(',');
    if (key(next.repositories) !== key(current.repositories)) return true;
  }
  return false;
}
