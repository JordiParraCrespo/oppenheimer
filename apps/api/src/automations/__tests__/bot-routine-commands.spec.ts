import { emptyScope } from '@oppenheimer/backend-authz';
import { Some } from 'oxide.ts';
import type { AutomationRepositoryPort } from '../database/automation.repository.port';
import type { AutomationRunRepositoryPort } from '../database/automation-run.repository.port';
import { AutomationEntity } from '../domain/automation.entity';
import { triggerFromInput } from '../domain/trigger-config.policy';
import { DeleteAutomationCommand } from '../commands/delete-automation/delete-automation.command';
import { DeleteAutomationCommandHandler } from '../commands/delete-automation/delete-automation.command-handler';
import { RunAutomationCommand } from '../commands/run-automation/run-automation.command';
import { RunAutomationCommandHandler } from '../commands/run-automation/run-automation.command-handler';

/**
 * Run now and Delete from a bot's Routines tab (`26-bot-routines.md` §7) name
 * the bot in the path, and act only on that bot's routine. What breaks this:
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
    run: new RunAutomationCommandHandler(automations, runs),
    remove: new DeleteAutomationCommandHandler(automations),
  };
}

const scope = emptyScope('owner-1', 'org-1');

describe("a bot's routine, run or deleted from its tab", () => {
  it('runs and deletes the routine of the bot the path names', async () => {
    const { routine, run, remove, insertFiring, save } = setup();
    await run.execute(
      new RunAutomationCommand({
        scope,
        automationId: routine.id,
        botId: 'bot-1',
        idempotencyKey: null,
      }),
    );
    await remove.execute(
      new DeleteAutomationCommand({ scope, automationId: routine.id, botId: 'bot-1' }),
    );
    expect(insertFiring).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it("answers another bot's routine as not found, and runs or deletes nothing", async () => {
    const { routine, run, remove, insertFiring, save } = setup();
    await expect(
      run.execute(
        new RunAutomationCommand({
          scope,
          automationId: routine.id,
          botId: 'bot-2',
          idempotencyKey: null,
        }),
      ),
    ).rejects.toMatchObject({ code: 'AUTOMATIONS_001' });
    await expect(
      remove.execute(
        new DeleteAutomationCommand({ scope, automationId: routine.id, botId: 'bot-2' }),
      ),
    ).rejects.toMatchObject({ code: 'AUTOMATIONS_001' });
    expect(insertFiring).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
  });
});
