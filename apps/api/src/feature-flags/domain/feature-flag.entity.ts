import { randomUUID } from 'node:crypto';
import {
  AggregateRoot,
  ArgumentNotProvidedException,
  type CreateEntityProps,
} from '@oppenheimer/backend-ddd';
import type { FlagConfig, FlagRule, FlagServe, FlagValue } from '@oppenheimer/shared/feature-flags';
import { FlagConfigurationChangedDomainEvent } from './events/flag-configuration-changed.domain-event';

export interface FeatureFlagProps {
  /** The catalog key this row targets. Immutable. */
  key: string;
  enabled: boolean;
  rules: FlagRule[];
  fallthrough: FlagServe;
  /** Bucketing salt, generated once. See `FlagConfig.salt`. */
  salt: string;
  /** Who last changed it, for the control plane. The full history is the audit trail. */
  updatedBy: string | null;
}

export interface FlagTargeting {
  enabled: boolean;
  rules: FlagRule[];
  fallthrough: FlagServe;
}

/** Who changed something and why — recorded on the audit trail with the diff. */
export interface FlagChange {
  actorId: string | null;
  comment?: string | null;
}

/**
 * A flag's targeting on this deployment.
 *
 * The flag's *existence* is the catalog's business (`FEATURE_FLAGS` in
 * `@oppenheimer/shared`); this aggregate is the part an operator edits. A row is
 * created the first time someone saves targeting for a key, so a fresh install
 * has none and every flag serves its default.
 *
 * Every change raises {@link FlagConfigurationChangedDomainEvent} with the
 * before and after, so nothing about who-changed-what depends on the caller
 * remembering to log it.
 */
export class FeatureFlagEntity extends AggregateRoot<FeatureFlagProps> {
  static create(create: CreateEntityProps<FeatureFlagProps>): FeatureFlagEntity {
    return new FeatureFlagEntity(create);
  }

  /**
   * Targeting for a key nobody has configured yet, shaped to behave exactly
   * like no row at all: on, no rules, the default for everyone. So the first
   * change made to it — pulling a kill switch included — is a real change.
   * Nothing is raised here; that first change raises its own event.
   */
  static createFor(key: string, defaultValue: FlagValue): FeatureFlagEntity {
    return new FeatureFlagEntity({
      id: randomUUID(),
      props: {
        key,
        enabled: true,
        rules: [],
        fallthrough: { value: defaultValue },
        salt: randomUUID().slice(0, 8),
        updatedBy: null,
      },
    });
  }

  get key(): string {
    return this.props.key;
  }

  get enabled(): boolean {
    return this.props.enabled;
  }

  get rules(): FlagRule[] {
    return this.props.rules;
  }

  get fallthrough(): FlagServe {
    return this.props.fallthrough;
  }

  get salt(): string {
    return this.props.salt;
  }

  get updatedBy(): string | null {
    return this.props.updatedBy;
  }

  /** Every segment key the rules target. */
  referencedSegments(): string[] {
    return [
      ...new Set(
        this.props.rules.flatMap((rule) =>
          rule.conditions
            .filter((condition) => condition.attribute === 'segment')
            .flatMap((condition) => condition.values),
        ),
      ),
    ];
  }

  /** The evaluator's view of this row. */
  toConfig(): FlagConfig {
    return {
      key: this.props.key,
      enabled: this.props.enabled,
      rules: this.props.rules,
      fallthrough: this.props.fallthrough,
      salt: this.props.salt,
    };
  }

  /** Replace the whole targeting. Validity against the catalog is the handler's check. */
  replaceTargeting(targeting: FlagTargeting, change: FlagChange): void {
    const before = this.targetingSnapshot();
    this.props.enabled = targeting.enabled;
    this.props.rules = targeting.rules;
    this.props.fallthrough = targeting.fallthrough;
    this.touch(change);
    this.record('targeting_updated', change, before);
  }

  /**
   * Flip the master switch. Returns whether anything changed — pulling a
   * switch that is already pulled is not an event worth auditing.
   */
  setEnabled(enabled: boolean, change: FlagChange): boolean {
    if (this.props.enabled === enabled) return false;
    const before = this.targetingSnapshot();
    this.props.enabled = enabled;
    this.touch(change);
    this.record('toggled', change, before);
    return true;
  }

  private touch(change: FlagChange): void {
    this.props.updatedBy = change.actorId;
    this.setUpdatedAt(new Date());
    this.validate();
  }

  private targetingSnapshot(): Record<string, unknown> {
    return {
      enabled: this.props.enabled,
      rules: this.props.rules,
      fallthrough: this.props.fallthrough,
    };
  }

  private record(
    action: 'targeting_updated' | 'toggled',
    change: FlagChange,
    before: Record<string, unknown>,
  ): void {
    this.addEvent(
      new FlagConfigurationChangedDomainEvent({
        aggregateId: this.id,
        subjectType: 'flag',
        subjectKey: this.props.key,
        action,
        actorId: change.actorId,
        comment: change.comment ?? null,
        before,
        after: this.targetingSnapshot(),
        reason: `Feature flag "${this.props.key}" changed; audit it and rebuild every replica's snapshot`,
      }),
    );
  }

  public validate(): void {
    if (!this.props.key?.trim()) {
      throw new ArgumentNotProvidedException('Feature flag key cannot be empty');
    }
    if (!this.props.salt?.trim()) {
      throw new ArgumentNotProvidedException('Feature flag salt cannot be empty');
    }
  }
}
