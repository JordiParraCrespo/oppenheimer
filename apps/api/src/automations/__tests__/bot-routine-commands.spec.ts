import { Some } from 'oxide.ts';
import { emptyScope } from '../../authz/domain/access-scope.types';
import { BotRoutineResolver } from '../application/bot-routine.resolver';
import { DeleteBotRoutineCommand } from '../commands/delete-bot-routine/delete-bot-routine.command';
import { DeleteBotRoutineCommandHandler } from '../commands/delete-bot-routine/delete-bot-routine.command-handler';
import { RunBotRoutineCommand } from '../commands/run-bot-routine/run-bot-routine.command';
import { RunBotRoutineCommandHandler } from '../commands/run-bot-routine/run-bot-routine.command-handler';
import type { AutomationRepositoryPort } from '../database/automation.repository.port';
import type { AutomationRunRepositoryPort } from '../database/automation-run.repository.port';
import { AutomationEntity } from '../domain/automation.entity';
import { triggerFromInput } from '../domain/trigger-config.policy';

/**
 * Run now and Delete for a bot (its Routines tab, `26-bot-routines.md` §7,
 * and its own tool) name the bot, and act only on that bot's routine, through
 * the one `BotRoutineResolver` that Save uses too. What breaks this:
 * one bot's tab running or deleting another bot's routine by its id, or a
 * session automation's. Neither answers anything but not found, and neither
 * writes.
 */
function setup() {
  const routine = AutomationEntity.createRoutine({
    organizationId: 'org-1',
    ownerUserId: 'owner-1',
    botId: 'bot-1',
    name: 'Morning PR digest',
    prompt: 'List the open pull requests.',
    triggers: [
      triggerFromInput(
        { source: 'schedule', frequency: 'daily', hour: 9, minute: 0, timezone: 'UTC' },
        0,
      ),
    ],
    active: true,
    credentialScopes: null,
    now: new Date(),
  });
  const save = vi.fn<AutomationRepositoryPort['save']>(async () => 'saved');
  const automations = {
    findOneById: vi.fn(async () => Some(routine)),
    save,
  } as unknown as AutomationRepositoryPort;
  const insertFiring = vi.fn<AutomationRunRepositoryPort['insertFiring']>(async () => ({
    runId: 'run-1',
    inserted: true,
  }));
  const runs = { insertFiring } as unknown as AutomationRunRepositoryPort;
  return {
    routine,
    save,
    insertFiring,
    run: new RunBotRoutineCommandHandler(new BotRoutineResolver(automations), runs),
    remove: new DeleteBotRoutineCommandHandler(new BotRoutineResolver(automations), automations),
  };
}

const scope = emptyScope('owner-1', 'org-1');

describe("a bot's routine, run or deleted from its tab", () => {
  it('runs and deletes the routine of the bot the path names', async () => {
    const { routine, run, remove, insertFiring, save } = setup();
    await run.execute(
      new RunBotRoutineCommand({
        scope,
        botId: 'bot-1',
        routineId: routine.id,
        idempotencyKey: null,
      }),
    );
    await remove.execute(
      new DeleteBotRoutineCommand({ scope, botId: 'bot-1', routineId: routine.id }),
    );
    expect(insertFiring).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it("answers another bot's routine as not found, and runs or deletes nothing", async () => {
    const { routine, run, remove, insertFiring, save } = setup();
    await expect(
      run.execute(
        new RunBotRoutineCommand({
          scope,
          botId: 'bot-2',
          routineId: routine.id,
          idempotencyKey: null,
        }),
      ),
    ).rejects.toMatchObject({ code: 'AUTOMATIONS_001' });
    await expect(
      remove.execute(new DeleteBotRoutineCommand({ scope, botId: 'bot-2', routineId: routine.id })),
    ).rejects.toMatchObject({ code: 'AUTOMATIONS_001' });
    expect(insertFiring).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
  });
});
