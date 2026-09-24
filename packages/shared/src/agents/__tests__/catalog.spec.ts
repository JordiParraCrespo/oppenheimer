import { describe, expect, it } from 'vitest';
import {
  CODING_AGENT_IDS,
  CODING_AGENTS,
  type CodingAgentId,
  isCodingAgentId,
  SESSION_EFFORTS,
  SESSION_PERMISSIONS,
  type SessionPermission,
} from '../catalog';

describe('coding agent catalog', () => {
  it('has an entry per id, keyed by it', () => {
    expect(Object.keys(CODING_AGENTS).sort()).toEqual([...CODING_AGENT_IDS].sort());
    for (const id of CODING_AGENT_IDS) {
      expect(CODING_AGENTS[id].id).toBe(id);
    }
  });

  it('names the launch command and the variable that scopes the login', () => {
    expect(CODING_AGENTS['claude-code'].command).toBe('claude');
    expect(CODING_AGENTS['claude-code'].configDirEnv).toBe('CLAUDE_CONFIG_DIR');
    expect(CODING_AGENTS.codex.command).toBe('codex');
    expect(CODING_AGENTS.codex.configDirEnv).toBe('CODEX_HOME');
    expect(CODING_AGENTS.opencode.command).toBe('opencode');
    expect(CODING_AGENTS.opencode.configDirEnv).toBe('XDG_DATA_HOME');
  });

  it('offers the plain terminal as an entry with nothing to launch', () => {
    const shell = CODING_AGENTS.shell;
    expect(shell.command).toBe('');
    expect(shell.models).toEqual([]);
    expect(shell.launch).toEqual({});
    // A shell prints any URL it is asked to; none of them is a login button.
    expect(shell.loginUrlPattern).toBeUndefined();
  });

  it('records where each CLI writes the transcript the first prompt is read from', () => {
    expect(CODING_AGENTS['claude-code'].transcriptLocation).toEqual({
      directory: '~/.claude/projects/',
      keyedBy: 'working-directory',
    });
    expect(CODING_AGENTS.codex.transcriptLocation.directory).toBe('~/.codex/sessions/');
  });

  it('is frozen, because every tier reads the same object', () => {
    expect(Object.isFrozen(CODING_AGENTS)).toBe(true);
    expect(Object.isFrozen(CODING_AGENTS.codex)).toBe(true);
  });

  describe('loginUrlPattern', () => {
    function pattern(id: CodingAgentId): string {
      const source = CODING_AGENTS[id].loginUrlPattern;
      if (!source) throw new Error(`${id} has no login pattern`);
      return source;
    }

    it('matches the vendor login URLs the CLIs print', () => {
      const claude = new RegExp(pattern('claude-code'));
      expect(claude.test('https://claude.ai/oauth/authorize?code=true')).toBe(true);
      expect(claude.test('https://console.anthropic.com/login')).toBe(true);

      const codex = new RegExp(pattern('codex'));
      expect(codex.test('https://auth.openai.com/authorize?x=1')).toBe(true);
      expect(codex.test('https://chatgpt.com/codex/login')).toBe(true);

      // OpenCode prints whichever provider's login is picked, its own included.
      const opencode = new RegExp(pattern('opencode'));
      expect(opencode.test('https://opencode.ai/auth')).toBe(true);
      expect(opencode.test('https://claude.ai/oauth/authorize?code=true')).toBe(true);
      expect(opencode.test('https://github.com/login/device')).toBe(true);
    });

    it('is anchored, so a lookalike host is not a login URL (F3)', () => {
      for (const id of ['claude-code', 'opencode'] as const) {
        const re = new RegExp(pattern(id));
        expect(re.test('https://claude.ai.attacker.test/oauth')).toBe(false);
        expect(re.test('https://evil.test/?next=https://claude.ai/')).toBe(false);
        expect(re.test('http://claude.ai/oauth')).toBe(false);
      }
      const opencode = new RegExp(pattern('opencode'));
      expect(opencode.test('https://opencode.ai.attacker.test/auth')).toBe(false);
      expect(opencode.test('https://github.com/evil')).toBe(false);
    });

    it('does not cross the vendors', () => {
      const claude = new RegExp(pattern('claude-code'));
      expect(claude.test('https://auth.openai.com/authorize')).toBe(false);
      expect(claude.test('https://opencode.ai/auth')).toBe(false);
    });
  });
});

/**
 * F3 on the wire is asserted in `src/protocol/__tests__/protocol.spec.ts`
 * ("F3: a login URL on the wire is a vendor login URL"), against
 * `sessionSnapshotSchema` — the field the console actually turns into a button.
 * The tests below cover the pattern itself; that suite covers the enforcement,
 * so an anchored pattern nothing calls cannot pass as protection.
 */
describe('isCodingAgentId', () => {
  it('accepts catalog ids and rejects anything else', () => {
    expect(isCodingAgentId('claude-code')).toBe(true);
    expect(isCodingAgentId('codex')).toBe(true);
    expect(isCodingAgentId('opencode')).toBe(true);
    expect(isCodingAgentId('shell')).toBe(true);
    expect(isCodingAgentId('cursor')).toBe(false);
    expect(isCodingAgentId('')).toBe(false);
    expect(isCodingAgentId(null)).toBe(false);
    expect(isCodingAgentId(42)).toBe(false);
  });

  it('narrows the type', () => {
    const value: unknown = 'codex';
    if (isCodingAgentId(value)) {
      const id: CodingAgentId = value;
      expect(CODING_AGENTS[id].label).toBe('Codex');
    }
  });
});

/**
 * The launch mapping is the file's one safety-critical table: `full` is the
 * level that changes somebody's machine unattended, so a permission that
 * silently fell back to another agent's flags, or a level missing from a map,
 * is the bug worth a suite of its own.
 *
 * What is asserted is the *shape and totality* of the mapping, never the exact
 * flags — those were read off each CLI's own `--help` and change when the CLI
 * does, and a test restating them would only assert that this file equals
 * itself.
 */
describe('launch mapping', () => {
  /** A level as the host receives it: its environment, then its argv. */
  function spelled(id: CodingAgentId, level: SessionPermission): string {
    const { permission, permissionEnv } = CODING_AGENTS[id].launch;
    const env = Object.entries(permissionEnv?.[level] ?? {}).map(
      ([name, value]) => `${name}=${value}`,
    );
    return [...env, ...(permission?.[level] ?? [])].join(' ');
  }

  it('maps every permission level, for every agent that has approvals', () => {
    for (const id of CODING_AGENT_IDS) {
      const { permission, permissionEnv } = CODING_AGENTS[id].launch;
      // A plain shell has no approvals; everything else states all three.
      if (id === 'shell') {
        expect(permission).toBeUndefined();
        continue;
      }
      expect(permission, `${id} has no permission map`).toBeDefined();
      expect(Object.keys(permission ?? {}).sort()).toEqual([...SESSION_PERMISSIONS].sort());
      if (permissionEnv) {
        expect(Object.keys(permissionEnv).sort()).toEqual([...SESSION_PERMISSIONS].sort());
      }
      for (const level of SESSION_PERMISSIONS) {
        expect(spelled(id, level), `${id} states nothing for ${level}`).not.toBe('');
      }
    }
  });

  it('maps every effort stop where the agent has a notion of effort', () => {
    for (const id of CODING_AGENT_IDS) {
      const { effort } = CODING_AGENTS[id].launch;
      if (!effort) continue;
      expect(Object.keys(effort).sort()).toEqual([...SESSION_EFFORTS].sort());
      for (const stop of SESSION_EFFORTS) {
        expect(effort[stop].length, `${id} states nothing for ${stop}`).toBeGreaterThan(0);
      }
    }
  });

  it('gives each level its own flags, so no two levels are the same choice', () => {
    for (const id of CODING_AGENT_IDS) {
      if (!CODING_AGENTS[id].launch.permission) continue;
      const levels = SESSION_PERMISSIONS.map((level) => spelled(id, level));
      expect(new Set(levels).size, `${id} spells two permission levels the same`).toBe(
        SESSION_PERMISSIONS.length,
      );
    }
  });

  it('substitutes a model rather than concatenating one', () => {
    for (const id of CODING_AGENT_IDS) {
      const { model } = CODING_AGENTS[id].launch;
      if (!model) continue;
      expect(model, `${id} takes a model but names no placeholder`).toContain('<model>');
    }
  });

  it('substitutes the first task rather than concatenating it, and puts it last', () => {
    for (const id of CODING_AGENT_IDS) {
      const { prompt } = CODING_AGENTS[id].launch;
      if (!prompt) continue;
      expect(prompt, `${id} takes a first task but names no placeholder`).toContain('<prompt>');
      // The trailing positional is the whole reason this is argv rather than
      // something typed at a running TUI: a placeholder anywhere but the end
      // would put the person's sentence where a flag's value belongs, and every
      // CLI here documents it as the last argument or its trailing flag's value.
      expect(prompt.at(-1), `${id} does not end on the task`).toBe('<prompt>');
    }
  });

  it('offers models the agent can be launched with, or none at all', () => {
    for (const id of CODING_AGENT_IDS) {
      const { models, launch } = CODING_AGENTS[id];
      // A model list on an agent that takes no `--model` is a list nothing can
      // be done with; the reverse — a `--model` with no list yet — is the
      // discovery question still open, and is allowed.
      if (models.length) expect(launch.model, `${id} lists models it cannot pass`).toBeDefined();
      // At most one default, or the picker has to choose between them.
      expect(models.filter((model) => model.default).length).toBeLessThanOrEqual(1);
      expect(new Set(models.map((model) => model.id)).size).toBe(models.length);
    }
  });

  it('seeds each agent with its family, every row naming the model it runs', () => {
    // The pair is the assertion. A label names a generation, so its id has to
    // name the same one: an alias (`opus`, `gpt-5.6`) moves under a versioned
    // label and the two go out of step on the host, with nothing on screen
    // saying so.
    expect(CODING_AGENTS['claude-code'].models.map((model) => [model.id, model.label])).toEqual([
      ['claude-fable-5-1', 'Claude Fable 5.1'],
      ['claude-opus-5-5', 'Claude Opus 5.5'],
      ['claude-sonnet-5', 'Claude Sonnet 5'],
      ['claude-haiku-4-5', 'Claude Haiku 4.5'],
    ]);
    expect(CODING_AGENTS.codex.models.map((model) => [model.id, model.label])).toEqual([
      ['gpt-6-astra', 'GPT-6 Astra'],
      ['gpt-5.6-sol', 'GPT-5.6 Sol'],
      ['gpt-5.6-terra', 'GPT-5.6 Terra'],
      ['gpt-5.6-luna', 'GPT-5.6 Luna'],
    ]);

    // Each agent's default is the one its own CLI would have run.
    expect(CODING_AGENTS['claude-code'].models.find((model) => model.default)?.id).toBe(
      'claude-opus-5-5',
    );
    // OpenCode offers the same family under its `anthropic/` provider.
    expect(CODING_AGENTS.opencode.models.map((model) => model.id)).toEqual([
      'anthropic/claude-fable-5-1',
      'anthropic/claude-opus-5-5',
      'anthropic/claude-sonnet-5',
      'anthropic/claude-haiku-4-5',
      'openai/gpt-5.6-sol',
    ]);
    expect(CODING_AGENTS.codex.models.find((model) => model.default)?.id).toBe('gpt-5.6-sol');
  });

  it('is frozen, like the rest of the catalog', () => {
    for (const id of CODING_AGENT_IDS) {
      expect(Object.isFrozen(CODING_AGENTS[id].launch)).toBe(true);
      if (CODING_AGENTS[id].launch.permission) {
        expect(Object.isFrozen(CODING_AGENTS[id].launch.permission)).toBe(true);
      }
      expect(Object.isFrozen(CODING_AGENTS[id].models)).toBe(true);
    }
  });
});

describe('the runner launch table', () => {
  it('is the committed generation of this catalog, so the host cannot drift from the console', async () => {
    const { readFileSync } = await import('node:fs');
    const { createRequire } = await import('node:module');
    const require = createRequire(import.meta.url);
    // The generator reads the built catalog, as the shared build does; the
    // committed Go file must be byte-identical to what it renders now.
    const { outputPath, render } = require('../../../scripts/emit-agent-catalog.cjs');
    expect(readFileSync(outputPath, 'utf8')).toBe(render());
  });
});
