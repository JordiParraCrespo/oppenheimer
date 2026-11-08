import { Injectable } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { FindHostQuery } from '../../hosts/queries/find-host/find-host.query';
import { type BotToolCallContext, BotToolRefusal } from './bot-tool.factory';

/**
 * The host a host-scoped tool acts on (`run_command`, the terminal tools):
 * the one the call names, else the bot's home host. One decision, and one
 * refusal in words the model can correct, for every such tool.
 */
@Injectable()
export class BotHostTargetResolver {
  constructor(private readonly queryBus: QueryBus) {}

  /** The call's host, without checking it is the owner's: for hooks after `normalize`. */
  idOf(input: { host_id?: string }, context: BotToolCallContext): string {
    const hostId = input.host_id ?? context.homeHostId;
    if (!hostId) {
      throw new BotToolRefusal(
        'No host named and you have no home host: ask which host to use, and say they can set one in Settings → Home host.',
      );
    }
    return hostId;
  }

  /**
   * The call's host, checked to be one the owner has, before any card is
   * raised: a made-up or someone else's host id is refused, so the owner is
   * never asked to approve a call to a host that is not theirs.
   */
  async usable(input: { host_id?: string }, context: BotToolCallContext): Promise<string> {
    const hostId = this.idOf(input, context);
    const found = await this.queryBus
      .execute(new FindHostQuery({ scope: context.owner, hostId }))
      .then(() => true)
      .catch(() => false);
    if (!found) {
      throw new BotToolRefusal(
        `${hostId} is not one of the person's hosts. Leave host_id out to use your home host, or take a host id from list_hosts or the turn context; never make one up.`,
      );
    }
    return hostId;
  }

  /** The host's name as the owner sees it, or its id when it cannot be read. */
  async name(context: BotToolCallContext, hostId: string): Promise<string> {
    const overview = await this.queryBus
      .execute<FindHostQuery, { host: { name: string } }>(
        new FindHostQuery({ scope: context.owner, hostId }),
      )
      .catch(() => null);
    return overview?.host.name ?? `host ${hostId}`;
  }
}
