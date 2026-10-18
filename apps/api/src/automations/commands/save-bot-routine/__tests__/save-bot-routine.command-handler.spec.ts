import { emptyScope } from '@oppenheimer/backend-authz';
import { Some } from 'oxide.ts';
import type { AutomationPlanFactory } from '../../../application/automation-plan.factory';
import type { AutomationRepositoryPort } from '../../../database/automation.repository.port';
import { AutomationEntity } from '../../../domain/automation.entity';
import { triggerFromInput } from '../../../domain/trigger-config.policy';
import { SaveBotRoutineCommand } from '../save-bot-routine.command';
import { SaveBotRoutineCommandHandler } from '../save-bot-routine.command-handler';

/**
 * Saving a bot's routine (`26-bot-routines.md` §4): an edit of what it runs or
 * when takes the scopes of the credential that made it, so a routine never
 * runs wider than its last editor; a pause or a resume leaves them alone.
 * What breaks this: an edit through a narrow API token leaving the routine on
 * a browser session's unlimited reach, or a pause from the console widening a
 * routine a token saved. The column round trip is the integration suite's.
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
    credentialScopes: ['automations:write'],
    now: new Date(),
  });
  const save = vi.fn<AutomationRepositoryPort['save']>(async () => 'saved');
  const automations = {
    findOneById: vi.fn(async () => Some(routine)),
    save,
  } as unknown as AutomationRepositoryPort;
  const handler = new SaveBotRoutineCommandHandler(
    automations,
    {} as unknown as AutomationPlanFactory,
  );
  const saveWith = (
    changes: SaveBotRoutineCommand['changes'],
    scopes: SaveBotRoutineCommand['credentialScopes'],
  ) =>
    handler.execute(
      new SaveBotRoutineCommand({
        scope: emptyScope('owner-1', 'org-1'),
        botId: 'bot-1',
        routineId: routine.id,
        changes,
        credentialScopes: scopes,
      }),
    );
  return { routine, save, saveWith };
}

describe('SaveBotRoutineCommandHandler', () => {
  it('gives an edited routine the scopes of the credential behind the edit', async () => {
    const { routine, save, saveWith } = setup();
    await saveWith({ prompt: 'List the open pull requests and their checks.' }, [
      'automations:read',
    ]);
    expect(save).toHaveBeenCalledTimes(1);
    expect(routine.credentialScopes).toEqual(['automations:read']);
  });

  it('leaves the scopes as they were on a pause from a browser session', async () => {
    const { routine, saveWith } = setup();
    await saveWith({ enabled: false }, null);
    expect(routine.isPaused).toBe(true);
    expect(routine.credentialScopes).toEqual(['automations:write']);
  });
});
