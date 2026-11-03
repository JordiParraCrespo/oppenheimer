import type { CreateSessionInput, HostEntity, SessionEntity } from '@oppenheimer/frontend-consumer';
import { canTeleport } from '@oppenheimer/shared/agents';

/**
 * Where a cloud session is continued when the reader picks no host: the host
 * that started it while it is online, else the first online host. Undefined
 * when none is online, since a session on an offline host would only queue.
 */
export function continueHost(
  hosts: readonly HostEntity[],
  startedOn: string | null,
): HostEntity | undefined {
  const online = hosts.filter((host) => host.online);
  return online.find((host) => host.id === startedOn) ?? online[0];
}

/**
 * Whether a host can continue `session` in a worktree of its own, with its
 * branch and history (`claude --teleport`): a cloud session a host started
 * for an agent that teleports (Claude Code's), on the one repository it
 * worked on, once its vendor has given it an id.
 */
export function canContinueOnHost(session: SessionEntity): boolean {
  return (
    session.place === 'cloud' &&
    session.cloud === null &&
    canTeleport(session.agent) &&
    session.cloudSessionId !== null &&
    session.checkouts.length === 1
  );
}

/**
 * The create that continues `session` on `hostId`: a worktree of its
 * repository, from the base it started on, in its project and under its
 * name, whose agent opens the cloud session there. No first task, since the
 * conversation holds it. Null when it cannot be continued on a host.
 */
export function continueOnHost(session: SessionEntity, hostId: string): CreateSessionInput | null {
  const [checkout] = session.checkouts;
  const { agent, cloudSessionId } = session;
  if (!canContinueOnHost(session) || !checkout || !cloudSessionId || !canTeleport(agent)) {
    return null;
  }
  return {
    hostId,
    agent,
    projectId: session.projectId,
    name: session.name,
    checkouts: [
      {
        installationId: checkout.installationId,
        githubRepoId: Number(checkout.githubRepoId),
        baseBranch: checkout.baseBranch,
      },
    ],
    teleport: cloudSessionId,
  };
}
