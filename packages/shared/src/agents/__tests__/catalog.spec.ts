import { describe, expect, it } from 'vitest';
import {
  CODING_AGENT_IDS,
  CODING_AGENTS,
  type CodingAgentId,
  isCodingAgentId,
  SESSION_EFFORTS,
  SESSION_PERMISSIONS,
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
    it('matches the vendor login URLs the CLIs print', () => {
      const claude = new RegExp(CODING_AGENTS['claude-code'].loginUrlPattern);
      expect(claude.test('https://claude.ai/oauth/authorize?code=true')).toBe(true);
      expect(claude.test('https://console.anthropic.com/login')).toBe(true);

      const codex = new RegExp(CODING_AGENTS.codex.loginUrlPattern);
      expect(codex.test('https://auth.openai.com/authorize?x=1')).toBe(true);
      expect(codex.test('https://chatgpt.com/codex/login')).toBe(true);
    });

    it('is anchored, so a lookalike host is not a login URL (F3)', () => {
      const claude = new RegExp(CODING_AGENTS['claude-code'].loginUrlPattern);
      expect(claude.test('https://claude.ai.attacker.test/oauth')).toBe(false);
      expect(claude.test('https://evil.test/?next=https://claude.ai/')).toBe(false);
      expect(claude.test('http://claude.ai/oauth')).toBe(false);
    });

    it('does not cross the vendors', () => {
      const claude = new RegExp(CODING_AGENTS['claude-code'].loginUrlPattern);
      expect(claude.test('https://auth.openai.com/authorize')).toBe(false);
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
  it('maps every permission level, for every agent', () => {
    for (const id of CODING_AGENT_IDS) {
      const { permission } = CODING_AGENTS[id].launch;
      expect(Object.keys(permission).sort()).toEqual([...SESSION_PERMISSIONS].sort());
      for (const level of SESSION_PERMISSIONS) {
        expect(permission[level].length, `${id} states nothing for ${level}`).toBeGreaterThan(0);
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
      const { permission } = CODING_AGENTS[id].launch;
      const spelled = SESSION_PERMISSIONS.map((level) => permission[level].join(' '));
      expect(new Set(spelled).size, `${id} spells two permission levels the same`).toBe(
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

  it('is frozen, like the rest of the catalog', () => {
    for (const id of CODING_AGENT_IDS) {
      expect(Object.isFrozen(CODING_AGENTS[id].launch)).toBe(true);
      expect(Object.isFrozen(CODING_AGENTS[id].launch.permission)).toBe(true);
      expect(Object.isFrozen(CODING_AGENTS[id].models)).toBe(true);
    }
  });
});
