/**
 * The spend guard stopping a bot (`26-bot-routines.md` §6). What breaks this:
 * the other routines left running, no word to the owner, or a word per
 * routine. Which routines pause is `automations/__tests__/unattended-routines.spec.ts`.
 */
import type { CommandBus } from '@nestjs/cqrs';
import { PauseUnattendedRoutinesCommand } from '../../../automations/commands/pause-unattended-routines/pause-unattended-routines.command';
import type { BotNoticeRepositoryPort } from '../../database/bot-notice.repository.port';
import type { BotNoticeEntity } from '../../domain/bot-notice.entity';
import { unattendedNotice } from '../../domain/bot-spend-guard.policy';
import { BotUnattendedRoutinesDomainEventHandler } from '../event-handlers/bot-unattended-routines.domain-event-handler';

function setup(teller: string | null) {
  const commands = { execute: vi.fn(async () => teller) };
  const put = vi.fn<BotNoticeRepositoryPort['put']>(async () => undefined);
  const handler = new BotUnattendedRoutinesDomainEventHandler(
    commands as unknown as CommandBus,
    { put } as unknown as BotNoticeRepositoryPort,
  );
  return { commands, put, handler };
}

const paused = (aggregateId: string, pausedReason: string | null = 'unattended') => ({
  aggregateId,
  organizationId: 'org-1',
  botId: 'bot-1',
  activity: 'paused' as const,
  pausedReason,
});

describe('BotUnattendedRoutinesDomainEventHandler', () => {
  it("pauses the bot's other routines and tells the owner once, from the routine named", async () => {
    const { commands, put, handler } = setup('routine-1');
    await handler.handle(paused('routine-1'));

    const [command] = commands.execute.mock.calls[0] as unknown as [PauseUnattendedRoutinesCommand];
    expect(command).toBeInstanceOf(PauseUnattendedRoutinesCommand);
    expect(command).toMatchObject({ organizationId: 'org-1', botId: 'bot-1' });
    expect(put).toHaveBeenCalledTimes(1);
    const [notice] = put.mock.calls[0] as [BotNoticeEntity];
    expect(notice).toMatchObject({ botId: 'bot-1', text: unattendedNotice() });
  });

  it('says nothing for the pause of another routine of the same stop', async () => {
    const { put, handler } = setup('routine-1');
    await handler.handle(paused('routine-2'));
    expect(put).not.toHaveBeenCalled();
  });

  it('leaves any other pause alone', async () => {
    const { commands, put, handler } = setup('routine-1');
    await handler.handle(paused('routine-1', 'user'));
    await handler.handle({ ...paused('routine-1'), activity: 'resumed' });
    expect(commands.execute).not.toHaveBeenCalled();
    expect(put).not.toHaveBeenCalled();
  });
});
