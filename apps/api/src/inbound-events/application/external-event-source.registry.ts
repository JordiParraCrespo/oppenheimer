import { Injectable } from '@nestjs/common';
import type { ExternalEventSourcePort } from './external-event-source.port';

/**
 * The sources the running application has, contributed by the modules that own
 * them (`InboundEventsModule.contributeSources`). A module that is not imported
 * contributes nothing, so the registry describes the application that is
 * actually running — the same kernel-style registry as `ProjectUsageRegistry`.
 */
@Injectable()
export class ExternalEventSourceRegistry {
  private readonly sources = new Map<string, ExternalEventSourcePort>();

  registerAll(sources: readonly ExternalEventSourcePort[]): void {
    for (const source of sources) {
      if (this.sources.has(source.id) && this.sources.get(source.id) !== source) {
        throw new Error(`Two adapters were contributed for the event source ${source.id}`);
      }
      this.sources.set(source.id, source);
    }
  }

  find(id: string): ExternalEventSourcePort | undefined {
    return this.sources.get(id);
  }
}
