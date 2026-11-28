import type { Option } from 'oxide.ts';
import type { HostRepositoryPort } from '../database/host.repository.port';
import type { HostEntity } from '../domain/host.entity';
import { retryHostWrite } from './host-write-retry.policy';

/** What an unpair found: the host it unpaired, one already unpaired, or none. */
export type HostUnpairOutcome = 'unpaired' | 'already-unpaired' | 'not-found';

/**
 * Unpairs one host, the one way every path does it: `load` reads the host
 * (through the caller's scope, or as the system), and the write is retried
 * on a fresh read with `retryHostWrite`, so losing twice is `HOSTS_009`.
 *
 * **Idempotent.** A host already unpaired, by an earlier try or by the
 * machine's own uninstall winning the race, is left as it is, so
 * `HostUnpairedDomainEvent` is raised once. What a missing host means is the
 * caller's to answer.
 */
export async function unpairHost(
  hosts: Pick<HostRepositoryPort, 'save'>,
  hostId: string,
  load: () => Promise<Option<HostEntity>>,
  { now, wipe = false }: { now: Date; wipe?: boolean },
): Promise<HostUnpairOutcome> {
  return retryHostWrite(hostId, async () => {
    const found = await load();
    if (found.isNone()) return 'not-found';
    const host = found.unwrap();
    if (host.isUnpaired) return 'already-unpaired';
    host.unpair(now, { wipe });
    await hosts.save(host);
    return 'unpaired';
  });
}
