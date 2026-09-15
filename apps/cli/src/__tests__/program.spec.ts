import { describe, expect, it } from 'vitest';
import { parseRules } from '../commands/roles';
import { CliError, ExitCode } from '../lib/errors';
import { formatDate, formatList, table } from '../lib/output';
import { createProgram } from '../program';

describe('command tree', () => {
  const program = createProgram();
  const names = program.commands.map((command) => command.name());

  it('exposes the documented top-level commands', () => {
    expect(names).toEqual(
      expect.arrayContaining([
        'login',
        'logout',
        'whoami',
        'users',
        'roles',
        'orgs',
        'workspaces',
        'tokens',
        'mcp',
      ]),
    );
  });

  it('describes every command, so --help is useful', () => {
    for (const command of program.commands) {
      expect(command.description()).not.toBe('');
      for (const sub of command.commands) {
        expect(sub.description()).not.toBe('');
      }
    }
  });

  it('offers the global flags every command relies on', () => {
    const flags = program.options.map((option) => option.long);
    expect(flags).toEqual(expect.arrayContaining(['--api-url', '--token', '--profile', '--json']));
  });

  it('groups token management under `tokens`', () => {
    const tokens = program.commands.find((command) => command.name() === 'tokens');
    expect(tokens?.commands.map((command) => command.name())).toEqual([
      'list',
      'create',
      'revoke',
      'permissions',
    ]);
  });

  it('requires the permissions flag when minting a token', () => {
    const create = program.commands
      .find((command) => command.name() === 'tokens')
      ?.commands.find((command) => command.name() === 'create');

    const required = create?.options.filter((option) => option.required).map((o) => o.long);
    expect(required).toEqual(expect.arrayContaining(['--name', '--permissions']));
  });
});

describe('parseRules', () => {
  it('parses action:subject pairs', () => {
    expect(parseRules('read:User,update:Article')).toEqual([
      { action: 'read', subject: 'User' },
      { action: 'update', subject: 'Article' },
    ]);
  });

  it('treats an empty input as no rules', () => {
    expect(parseRules(undefined)).toEqual([]);
    expect(parseRules('')).toEqual([]);
  });

  it('ignores stray whitespace and empty entries', () => {
    expect(parseRules(' read:User , ')).toEqual([{ action: 'read', subject: 'User' }]);
  });

  it('rejects a malformed pair with a usage error', () => {
    expect(() => parseRules('readUser')).toThrow(CliError);
    try {
      parseRules('read:User:extra');
    } catch (error) {
      expect((error as CliError).exitCode).toBe(ExitCode.USAGE);
    }
  });
});

describe('output helpers', () => {
  it('aligns columns to the widest cell', () => {
    const rendered = table(
      [
        { name: 'a', value: 'short' },
        { name: 'bbbbb', value: 'x' },
      ],
      [
        { header: 'NAME', value: (row) => row.name },
        { header: 'VALUE', value: (row) => row.value },
      ],
    );

    const [, first, second] = rendered.split('\n');
    expect(first.indexOf('short')).toBe(second.indexOf('x'));
  });

  it('reports an empty result rather than printing a bare header', () => {
    expect(table([], [{ header: 'NAME', value: () => '' }], 'Nothing here.')).toContain(
      'Nothing here.',
    );
  });

  it('formats timestamps and falls back for missing ones', () => {
    expect(formatDate('2026-03-04T10:11:12.000Z')).toBe('2026-03-04 10:11');
    expect(formatDate(null)).toBe('—');
    expect(formatDate('not a date')).toBe('—');
  });

  it('formats lists and falls back for empty ones', () => {
    expect(formatList(['a', 'b'])).toBe('a, b');
    expect(formatList([], 'all')).toBe('all');
    expect(formatList(null, 'all')).toBe('all');
  });
});

describe('exit codes', () => {
  it('keeps the documented numbering', () => {
    // Scripts branch on these; changing one is a breaking change.
    expect(ExitCode).toEqual({
      OK: 0,
      FAILURE: 1,
      USAGE: 2,
      AUTH: 3,
      FORBIDDEN: 4,
      NOT_FOUND: 5,
      UNREACHABLE: 6,
    });
  });
});
