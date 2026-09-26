import { injectable } from 'inversify';
import type { RoutineEntity } from './routine.entity';

/**
 * The routines the workspace has.
 *
 * The control plane has no automations resource yet — the endpoints are
 * note 13's next slice — so there is nothing to ask it and none to list:
 * the answer is the empty list, and it is a fact rather than a stand-in.
 * When the endpoints land, this reads them through the generated client the
 * way `HostsRepository` does, and the pages that render the rows follow.
 */
@injectable()
export class RoutinesRepository {
  async findAll(): Promise<RoutineEntity[]> {
    return [];
  }
}
