import { Injectable } from '@nestjs/common';
import type { ResourceDefinition } from './resource-definition';

/** One group of resources, as the role builder renders them. */
export interface ResourceGroup {
  group: string;
  resources: readonly ResourceDefinition[];
}

/**
 * Every resource the application has declared, collected at boot.
 *
 * This is the extension point that replaces editing a central literal: a
 * feature module registers its own declaration through
 * `AuthzModule.forFeature`, and the catalog endpoint, the scope engine, the
 * role builder and the coverage tests all read from here.
 *
 * Registration is idempotent by subject so a module imported twice does not
 * duplicate entries, but a *conflicting* redeclaration throws — two modules
 * disagreeing about what `Lead` means is a bug, not a merge.
 */
@Injectable()
export class ResourceRegistry {
  private readonly resources = new Map<string, ResourceDefinition>();

  register(definition: ResourceDefinition): void {
    const existing = this.resources.get(definition.subject);
    if (existing && existing !== definition) {
      throw new Error(
        `Resource "${definition.subject}" is already registered with a different definition`,
      );
    }
    this.resources.set(definition.subject, definition);
  }

  registerAll(definitions: readonly ResourceDefinition[]): void {
    for (const definition of definitions) this.register(definition);
  }

  /** The definition for a subject, or `undefined` if it was never declared. */
  get(subject: string): ResourceDefinition | undefined {
    return this.resources.get(subject);
  }

  /**
   * Like {@link get}, but throws. Use from code that cannot proceed without the
   * declaration (the scope engine), so a missing one surfaces as a clear error
   * rather than an unfiltered query.
   */
  getOrThrow(subject: string): ResourceDefinition {
    const definition = this.resources.get(subject);
    if (!definition) {
      throw new Error(
        `Resource "${subject}" is not registered. Declare it with defineResource() and pass it to AuthzModule.forFeature().`,
      );
    }
    return definition;
  }

  all(): readonly ResourceDefinition[] {
    return [...this.resources.values()].sort((a, b) => a.subject.localeCompare(b.subject));
  }

  /** Grouped and sorted, ready for the role builder. */
  byGroup(): readonly ResourceGroup[] {
    const groups = new Map<string, ResourceDefinition[]>();
    for (const resource of this.all()) {
      const bucket = groups.get(resource.group);
      if (bucket) bucket.push(resource);
      else groups.set(resource.group, [resource]);
    }
    return [...groups.entries()]
      .map(([group, resources]) => ({ group, resources }))
      .sort((a, b) => a.group.localeCompare(b.group));
  }

  /** Every `(action, subject)` pair the application knows about. */
  knownRules(): readonly { action: string; subject: string }[] {
    return this.all().flatMap((resource) =>
      resource.actions.map((action) => ({
        action: action.name,
        subject: resource.subject,
      })),
    );
  }
}
