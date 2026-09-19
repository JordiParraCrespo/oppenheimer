import { describe, expect, it } from 'vitest';
import { CODING_AGENT_IDS, CODING_AGENTS, type CodingAgentId, isCodingAgentId } from '../catalog';

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
