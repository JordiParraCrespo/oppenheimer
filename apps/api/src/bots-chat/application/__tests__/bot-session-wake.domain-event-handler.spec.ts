/**
 * Where a session's news reaches the bots that follow it
 * (`27-bot-subscriptions.md` §1): a task reaching a state that wakes, or the
 * session closing, asks every subscription to that session to wake; a task
 * merely starting or working asks none. What each wake then does is
 * `wake-subscribed-bot.command-handler.spec.ts`.
 */
import type { CommandBus } from '@nestjs/cqrs';
import { WakeSubscribedBotCommand } from '../../commands/wake-subscribed-bot/wake-subscribed-bot.command';
import type { BotSubscriptionRepositoryPort } from '../../database/bot-subscription.repository.port';
import { BotSessionWakeDomainEventHandler } from '../event-handlers/bot-session-wake.domain-event-handler';

function setup(ids: string[]) {
  const subscriptions = {
    findIdsForSession: vi.fn<BotSubscriptionRepositoryPort['findIdsForSession']>(async () => ids),
  };
  const commands = { execute: vi.fn(async () => undefined) };
  const handler = new BotSessionWakeDomainEventHandler(
    subscriptions as unknown as BotSubscriptionRepositoryPort,
    commands as unknown as CommandBus,
  );
  return { subscriptions, commands, handler };
}

describe('BotSessionWakeDomainEventHandler', () => {
  it('asks each subscription to the session to wake when its task needs input or ends', async () => {
    const { subscriptions, commands, handler } = setup(['sub-1', 'sub-2']);
    await handler.onTurn({ aggregateId: 'session-1', organizationId: 'org-1', to: 'completed' });
    expect(subscriptions.findIdsForSession).toHaveBeenCalledWith('org-1', 'session-1');
    const woken = commands.execute.mock.calls.map(
      ([command]) => command as WakeSubscribedBotCommand,
    );
    expect(woken.map((command) => command.subscriptionId)).toEqual(['sub-1', 'sub-2']);
    expect(woken[0]).toBeInstanceOf(WakeSubscribedBotCommand);
  });

  it('looks at nothing while a task is queued or working', async () => {
    const { subscriptions, commands, handler } = setup(['sub-1']);
    await handler.onTurn({ aggregateId: 'session-1', organizationId: 'org-1', to: 'in_progress' });
    await handler.onTurn({ aggregateId: 'session-1', organizationId: 'org-1', to: 'queued' });
    expect(subscriptions.findIdsForSession).not.toHaveBeenCalled();
    expect(commands.execute).not.toHaveBeenCalled();
  });

  // What breaks this: a subscription to a closed session waiting for ever.
  it('asks the subscriptions to a session that closed, so they end, and ignores other moves', async () => {
    const { commands, handler } = setup(['sub-1']);
    await handler.onState({ aggregateId: 'session-1', organizationId: 'org-1', to: 'open' });
    expect(commands.execute).not.toHaveBeenCalled();
    await handler.onState({ aggregateId: 'session-1', organizationId: 'org-1', to: 'resolved' });
    expect(commands.execute).toHaveBeenCalledTimes(1);
  });

  // What breaks this: one subscription whose wake fails keeping every other
  // bot that follows the session from hearing about it.
  it('wakes the others when one wake fails, then throws so the event is delivered again', async () => {
    const { commands, handler } = setup(['sub-1', 'sub-2', 'sub-3']);
    commands.execute.mockImplementation(async (command: unknown) => {
      if ((command as WakeSubscribedBotCommand).subscriptionId === 'sub-1') {
        throw new Error('connection reset');
      }
      return undefined;
    });
    await expect(
      handler.onTurn({ aggregateId: 'session-1', organizationId: 'org-1', to: 'failed' }),
    ).rejects.toThrow('connection reset');
    expect(commands.execute).toHaveBeenCalledTimes(3);
  });
});
