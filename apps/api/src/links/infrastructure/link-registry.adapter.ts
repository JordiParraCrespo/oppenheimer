import { Injectable } from '@nestjs/common';
import type { LinkRegistryPort, RunnerLink } from '../application/link-registry.port';

/**
 * The in-process registry: one map from host id to its live link.
 *
 * In-process is the MVP's decision (`03-control-plane.md`, open question 4):
 * the relay and the API are one process, so the host a session runs on is
 * either on this map or offline. When the relay splits into its own process the
 * map becomes a Redis lookup and this file is where that change lands.
 */
@Injectable()
export class InProcessLinkRegistry implements LinkRegistryPort {
  private readonly links = new Map<string, RunnerLink>();
  private readonly epochs = new Map<string, number>();

  /** Injected in tests; the wall clock otherwise. */
  constructor(private readonly now: () => number = Date.now) {}

  register(link: RunnerLink): RunnerLink | undefined {
    const previous = this.links.get(link.hostId);
    this.links.set(link.hostId, link);
    return previous;
  }

  unregister(link: RunnerLink): void {
    if (this.links.get(link.hostId) === link) this.links.delete(link.hostId);
  }

  find(hostId: string): RunnerLink | undefined {
    return this.links.get(hostId);
  }

  /**
   * Upward per host, and upward across restarts of this process: the runner
   * refuses a welcome whose epoch is not newer than the last one it accepted,
   * and a counter that restarted at 1 would keep a host off the link for as
   * many redials as it had epochs. The wall clock in milliseconds is the floor,
   * so the first epoch after a restart is already past every epoch before it.
   */
  nextEpoch(hostId: string): number {
    const epoch = Math.max((this.epochs.get(hostId) ?? 0) + 1, this.now());
    this.epochs.set(hostId, epoch);
    return epoch;
  }
}
