import type { AutomationEntity } from '@oppenheimer/frontend-consumer';
import type { TFunction } from 'i18next';
import { describe, expect, it } from 'vitest';
import { whereFields } from '../lib/where-fields';

/**
 * Where an automation runs, as its page lists it. What breaks if it drifts:
 * a host line with no name while the hosts load, a repository line for one
 * that clones none, or the agent missing.
 */
describe('where an automation runs, on the phone', () => {
  const t = ((key: string) => key) as unknown as TFunction;
  const automation = (repositories: string[]) =>
    ({
      revision: {
        agent: 'claude-code',
        model: null,
        place: 'host',
        repositories: repositories.map((fullName) => ({ fullName })),
      },
    }) as unknown as AutomationEntity;

  it('names the repositories by their short name, the host once known, and the agent', () => {
    const fields = whereFields(automation(['acme/xrp-mobile', 'acme/docs']), 'optimus', t);
    expect(fields.map((field) => field.label)).toEqual([
      'automations.editor.repositories',
      'automations.editor.host',
      'automations.editor.agent',
    ]);
    expect(fields[0]?.value).toBe('xrp-mobile, docs');
    expect(fields[2]?.value).toMatch(/^Claude Code · /);
  });

  it('leaves out a host not read yet and repositories it does not clone', () => {
    expect(whereFields(automation([]), null, t).map((field) => field.label)).toEqual([
      'automations.editor.agent',
    ]);
  });
});
