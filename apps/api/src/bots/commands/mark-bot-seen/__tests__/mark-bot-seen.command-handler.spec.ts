/**
 * The owner back in a bot's chat (`26-bot-routines.md` §6). What breaks this:
 * routines the guard paused staying paused when the owner is back, or another
 * workspace's bot marked through a guessed id. The once-a-minute write is
 * `bots.integration.spec.ts`.
 */
import type { CommandBus } from '@nestjs/cqrs';
import { emptyScope } from '@oppenheimer/backend-authz';
import { ResumeUnattendedRoutinesCommand } from '../../../../automations/commands/resume-unattended-routines/resume-unattended-routines.command';
import type { BotRepositoryPort } from '../../../database/bot.repository.port';
import { MarkBotSeenCommand } from '../mark-bot-seen.command';
import { MarkBotSeenCommandHandler } from '../mark-bot-seen.command-handler';

function setup(found: boolean) {
  const bots: Pick<BotRepositoryPort, 'markSeen'> = { markSeen: vi.fn(async () => found) };
  const commands = { execute: vi.fn(async () => 0) };
  const handler = new MarkBotSeenCommandHandler(
    bots as BotRepositoryPort,
    commands as unknown as CommandBus,
  );
  return { bots, commands, handler };
}

const command = () =>
  new MarkBotSeenCommand({ scope: emptyScope('owner-1', 'org-1'), botId: 'bot-1' });

describe('MarkBotSeenCommandHandler', () => {
  it('records the owner in the chat, then resumes what the guard paused', async () => {
    const { bots, commands, handler } = setup(true);
    await handler.execute(command());

    expect(bots.markSeen).toHaveBeenCalledWith(expect.anything(), 'bot-1', expect.any(Date));
    const [resume] = commands.execute.mock.calls[0] as unknown as [ResumeUnattendedRoutinesCommand];
    expect(resume).toBeInstanceOf(ResumeUnattendedRoutinesCommand);
    expect(resume).toMatchObject({ organizationId: 'org-1', botId: 'bot-1' });
  });

  it('answers BOTS_001 for a bot the workspace does not have, and resumes nothing', async () => {
    const { commands, handler } = setup(false);
    await expect(handler.execute(command())).rejects.toMatchObject({ code: 'BOTS_001' });
    expect(commands.execute).not.toHaveBeenCalled();
  });
});
