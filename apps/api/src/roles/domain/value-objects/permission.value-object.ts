import { ArgumentNotProvidedException, ValueObject } from '@oppenheimer/backend-ddd';
import type { PermissionDefinition } from '@oppenheimer/shared';

/**
 * Properties of a single permission rule. Mirrors `PermissionDefinition` from
 * `@oppenheimer/shared`: free-form `action`/`subject`, optional resource-scoping
 * `conditions`, attribute `fields`, and an `inverted` flag (turning the rule
 * into a `cannot`).
 */
export interface PermissionProps {
  action: string;
  subject: string;
  conditions?: Record<string, unknown>;
  fields?: string[];
  inverted?: boolean;
  reason?: string;
}

/**
 * A permission is an immutable value object: an `(action, subject)` pair plus
 * optional CASL refinements. Roles own a collection of these.
 */
export class Permission extends ValueObject<PermissionProps> {
  get action(): string {
    return this.props.action;
  }

  get subject(): string {
    return this.props.subject;
  }

  /** Plain object form used by the mapper (persistence) and CASL ability building. */
  toDefinition(): PermissionDefinition {
    return {
      action: this.props.action,
      subject: this.props.subject,
      ...(this.props.conditions ? { conditions: this.props.conditions } : {}),
      ...(this.props.fields ? { fields: this.props.fields } : {}),
      ...(this.props.inverted !== undefined ? { inverted: this.props.inverted } : {}),
      ...(this.props.reason ? { reason: this.props.reason } : {}),
    };
  }

  static fromDefinition(definition: PermissionDefinition): Permission {
    return new Permission({
      action: definition.action,
      subject: definition.subject,
      conditions: definition.conditions,
      fields: definition.fields,
      inverted: definition.inverted,
      reason: definition.reason,
    });
  }

  protected validate(props: PermissionProps): void {
    if (!props.action?.trim()) {
      throw new ArgumentNotProvidedException('Permission action cannot be empty');
    }
    if (!props.subject?.trim()) {
      throw new ArgumentNotProvidedException('Permission subject cannot be empty');
    }
  }
}
