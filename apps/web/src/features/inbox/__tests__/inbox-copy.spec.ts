import type { InboxItem } from '@oppenheimer/frontend-consumer';
import type { TFunction } from 'i18next';
import { describe, expect, it } from 'vitest';
import { inboxCopy } from '../lib/inbox-copy';

/**
 * A failed run's card says why in the host's own words. Those words come
 * from a terminal: Claude Code writes a cursor move for every space, so
 * shown as stored they read "Error:Cloudsessionsneedaclaude.aisign-in.", one
 * run-together word.
 */

const t = ((key: string) => key) as unknown as TFunction;

const failedRun = (failureDetail: string | null) =>
  ({
    kind: 'run',
    key: 'run:1',
    since: new Date(0),
    projectIds: [],
    low: false,
    run: {
      automationName: 'Verify main is green',
      automationDeleted: false,
      agent: 'claude',
      turn: failureDetail === null ? null : { failureDetail },
    },
  }) as unknown as InboxItem;

describe('inboxCopy for a failed run', () => {
  it('reads the host’s refusal as words, not as the terminal’s escapes', () => {
    const detail =
      '\x1b7\x1b8Error:\x1b[1CCloud\x1b[1Csessions\x1b[1Cneed\x1b[1Ca\x1b[1Cclaude.ai\x1b[1Csign-in. · Run\x1b[1C`claude\x1b[1Cauth\x1b[1Clogin`,\x1b[1Cthen\x1b[1Ctry\x1b[1Cagain. · \x1b(B\x1b7\x1b8';
    expect(inboxCopy(failedRun(detail), t).body).toBe(
      'Error: Cloud sessions need a claude.ai sign-in.\nRun `claude auth login`, then try again.',
    );
  });

  it('falls back to its own sentence when the host said nothing readable', () => {
    expect(inboxCopy(failedRun('\x1b(B\x1b7\x1b8\r\n'), t).body).toBe('inbox.run.body');
    expect(inboxCopy(failedRun(null), t).body).toBe('inbox.run.body');
  });
});
