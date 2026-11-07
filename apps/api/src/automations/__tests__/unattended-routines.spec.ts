/**
 * The spend guard's pause and its lift (`26-bot-routines.md` §6). What breaks
 * this: a bot's other routines running on after the guard stopped one, a
 * routine the owner paused themselves resumed when they come back, a pause
 * for a missing key lifted by a visit, or one Inbox line per routine. The
 * rule that decides is `bot-spend-guard.policy.spec.ts`.
 */

import { PauseUnattendedRoutinesCommand } from '../commands/pause-unattended-routines/pause-unattended-routines.command';
import { PauseUnattendedRoutinesCommandHandler } from '../commands/pause-unattended-routines/pause-unattended-routines.command-handler';
import { ResumeUnattendedRoutinesCommand } from '../commands/resume-unattended-routines/resume-unattended-routines.command';
import { ResumeUnattendedRoutinesCommandHandler } from '../commands/resume-unattended-routines/resume-unattended-routines.command-handler';
import type { AutomationRepositoryPort } from '../database/automation.repository.port';
import { AutomationEntity } from '../domain/automation.entity';
import { triggerFromInput } from '../domain/trigger-config.policy';

const now = new Date();

function routine(name: string) {
  return AutomationEntity.createRoutine({
    organizationId: 'org-1',
    ownerUserId: 'owner-1',
    botId: 'bot-1',
    name,
    prompt: 'Check in.',
    triggers: [
      triggerFromInput(
        { source: 'schedule', frequency: 'hourly', hour: 0, minute: 7, timezone: 'UTC' },
        0,
      ),
    ],
    active: true,
    credentialScopes: null,
    now,
  });
}

function setup(routines: AutomationEntity[]) {
  const automations: Pick<
    AutomationRepositoryPort,
    'findRoutinesOfBotForSystem' | 'saveForSystem'
  > = {
    findRoutinesOfBotForSystem: vi.fn(async () => routines),
    saveForSystem: vi.fn(async () => undefined),
  };
  const repository = automations as AutomationRepositoryPort;
  return {
    automations,
    pause: new PauseUnattendedRoutinesCommandHandler(repository),
    resume: new ResumeUnattendedRoutinesCommandHandler(repository),
  };
}

const ids = { organizationId: 'org-1', botId: 'bot-1' };

describe('pausing and resuming a bot’s routines for an owner who is away', () => {
  it('pauses every running routine and names the oldest as the one that tells', async () => {
    const [heartbeat, digest] = [routine('Heartbeat'), routine('PR digest')];
    digest.pause('unattended', now);
    const { pause, automations } = setup([heartbeat, digest]);

    const teller = await pause.execute(new PauseUnattendedRoutinesCommand(ids));

    expect(heartbeat.pausedReason).toBe('unattended');
    expect(automations.saveForSystem).toHaveBeenCalledTimes(1);
    expect(teller).toBe(heartbeat.id);
  });

  it('keeps the reason of a routine already paused, and saves nothing again', async () => {
    const mine = routine('Weekly report');
    mine.pause('user', now);
    const { pause, automations } = setup([mine]);

    expect(await pause.execute(new PauseUnattendedRoutinesCommand(ids))).toBeNull();
    expect(mine.pausedReason).toBe('user');
    expect(automations.saveForSystem).not.toHaveBeenCalled();
  });

  it('resumes only the routines paused while the owner was away', async () => {
    const [away, mine, keyless, running] = [
      routine('Heartbeat'),
      routine('Weekly report'),
      routine('PR digest'),
      routine('Mail triage'),
    ];
    away.pause('unattended', now);
    mine.pause('user', now);
    keyless.pause('bot_provider_missing', now);
    const { resume, automations } = setup([away, mine, keyless, running]);

    expect(await resume.execute(new ResumeUnattendedRoutinesCommand(ids))).toBe(1);
    expect(away.isPaused).toBe(false);
    expect([mine.pausedReason, keyless.pausedReason]).toEqual(['user', 'bot_provider_missing']);
    expect(automations.saveForSystem).toHaveBeenCalledTimes(1);
  });
});
