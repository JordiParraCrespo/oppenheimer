import { terminalDriveSchema } from '@oppenheimer/shared/protocol';
import { describe, expect, it } from 'vitest';
import { hostCommandIdOf } from '../application/bot-host-command.policy';
import { terminalCommandIdOf, toTerminalDriveRequest } from '../bot-terminal-tool.mapper';

describe('toTerminalDriveRequest', () => {
  it('sends only what the bot gave, with the wait defaulted', () => {
    expect(toTerminalDriveRequest({ text: 'ls', keys: ['Enter'] })).toEqual({
      text: 'ls',
      keys: ['Enter'],
      waitSeconds: 2,
    });
    expect(
      toTerminalDriveRequest({
        text: '',
        keys: [],
        wait_for: '\\$ $',
        wait_seconds: 9,
        history: 50,
      }),
    ).toEqual({
      waitFor: '\\$ $',
      waitSeconds: 9,
      history: 50,
    });
  });
});

describe('terminalCommandIdOf', () => {
  // A retried approval must reach the runner under its first id, or the
  // runner types the approved keys again.
  it('names one approval the same way every time, as a command id the link accepts', () => {
    const id = terminalCommandIdOf('approval-1');
    expect(terminalCommandIdOf('approval-1')).toBe(id);
    expect(terminalCommandIdOf('approval-2')).not.toBe(id);
    expect(id).not.toBe(hostCommandIdOf('approval-1'));
    expect(terminalDriveSchema.shape.commandId.safeParse(id).success).toBe(true);
  });
});
