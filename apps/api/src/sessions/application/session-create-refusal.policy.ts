import { AppError } from '@oppenheimer/backend-core';
import { HostErrors } from '../../hosts/domain/hosts.errors';
import type { SessionCreateOutcome } from '../database/work-session.repository.port';
import { SessionErrors } from '../domain/sessions.errors';

/**
 * The problem for a create the insert refused: its project was archived or its
 * host unpaired between the lookup and the insert, the race the locked row
 * decides. The same codes the lookups raise, so a client sees one answer.
 */
export function throwIfRefused(
  outcome: SessionCreateOutcome,
  names: { projectSlug: string; hostId: string },
): void {
  if (outcome.refused === 'project-archived') {
    throw new AppError(SessionErrors.PROJECT_ARCHIVED, {
      detail: `Project ${names.projectSlug} is archived`,
    });
  }
  if (outcome.refused === 'host-unpaired') {
    throw new AppError(HostErrors.NOT_FOUND, {
      detail: `No usable host with id ${names.hostId}`,
    });
  }
}
