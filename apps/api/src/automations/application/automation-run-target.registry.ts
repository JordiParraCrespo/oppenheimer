import { Injectable } from '@nestjs/common';
import type { AutomationRunTargetKind } from '../domain/automation.types';
import type { AutomationRunTargetPort } from './automation-run-target.port';

/**
 * The run targets the running application has, contributed by the modules that
 * own what a run starts (`AutomationsModule.contributeRunTargets`) — the same
 * kernel-style registry as `ExternalEventSourceRegistry`.
 */
@Injectable()
export class AutomationRunTargetRegistry {
  private readonly targets = new Map<AutomationRunTargetKind, AutomationRunTargetPort>();

  registerAll(targets: readonly AutomationRunTargetPort[]): void {
    for (const target of targets) {
      if (this.targets.has(target.kind) && this.targets.get(target.kind) !== target) {
        throw new Error(`Two adapters were contributed for the run target ${target.kind}`);
      }
      this.targets.set(target.kind, target);
    }
  }

  /** The target for a kind; an automation whose kind has none is a wiring fault, not a refusal. */
  get(kind: AutomationRunTargetKind): AutomationRunTargetPort {
    const target = this.targets.get(kind);
    if (!target) throw new Error(`No adapter was contributed for the run target ${kind}`);
    return target;
  }
}
