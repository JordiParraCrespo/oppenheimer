// The verification guard's policy (`verification.mjs`): which paths need the
// local stack and which (anything agentic) the evals, when each applies, and what answers
// it. The hook runs as Claude Code runs it, on a throwaway repository with an
// `origin/main`.
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { CHECKS, matcher, record } from './verification.mjs';

const HOOK = fileURLToPath(new URL('./verify-guard.mjs', import.meta.url));

describe('what each check covers', () => {
  const stack = matcher(CHECKS.stack);
  const agentic = matcher(CHECKS.evals);
  for (const path of [
    'apps/api/src/hosts/hosts.module.ts',
    'apps/runner/internal/link/link.go',
    'apps/web/src/features/sessions/list.tsx',
    'packages/shared/src/link/protocol.ts',
    'packages/backend/queue/src/index.ts',
    'packages/go/ws/conn.go',
  ])
    it(`runs ${path} on the stack`, () => assert.equal(stack(path), true));
  for (const path of [
    'apps/api/src/hosts/__tests__/hosts.spec.ts',
    'apps/runner/internal/link/link_test.go',
    'apps/runner/README.md',
    'apps/docs/docs/errors.md',
    '.agents/skills/local-stack/SKILL.md',
  ])
    it(`does not ask the stack for ${path}`, () => assert.equal(stack(path), false));
  for (const path of [
    'apps/api/src/bots-chat/domain/prompts/core/system.md',
    'apps/api/src/sessions/domain/prompts/system/title.md',
    'apps/api/src/sessions/domain/session-name.policy.ts',
    'apps/api/src/voice/application/voice-polish.resolver.ts',
    'apps/api/src/pull-requests/application/pull-request-brief.resolver.ts',
    'packages/backend/llm/src/llm.service.ts',
    'apps/api/src/bots-chat/application/bot-skill-tools.factory.ts',
    'apps/api/src/bots/domain/bot-naming.policy.ts',
    'packages/backend/agents/src/claude/claude-tool-server.ts',
  ])
    it(`evals ${path}`, () => assert.equal(agentic(path), true));
  for (const path of [
    'apps/api/src/bots-chat/__tests__/bot-memory.policy.spec.ts',
    'apps/api/src/bots/commands/create-bot/create-bot.service.ts',
    'apps/api/src/sessions/sessions.module.ts',
    'apps/api/src/voice/infrastructure/stt.adapter.ts',
  ])
    it(`does not ask an eval for ${path}`, () => assert.equal(agentic(path), false));
});

describe('the hook', () => {
  const root = mkdtempSync(join(tmpdir(), 'verify-guard-'));
  after(() => rmSync(root, { recursive: true, force: true }));
  const git = (...args) =>
    execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], {
      cwd: root,
      encoding: 'utf8',
    });
  const write = (path, body = 'x') => {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), body);
  };
  const commit = (path, body) => {
    write(path, body);
    git('add', path);
    git('commit', '-q', '-m', path);
  };
  /** The hook's reason for refusing `git push`, or null when it may run. */
  const push = (env = {}) => {
    const result = spawnSync('node', [HOOK], {
      cwd: root,
      env: { ...process.env, OPPENHEIMER_VERIFY_GUARD: '', CLAUDE_CODE_REMOTE: 'true', ...env },
      input: JSON.stringify({ cwd: root, tool_name: 'Bash', tool_input: { command: 'git push' } }),
      encoding: 'utf8',
    });
    assert.equal(result.status, 0, result.stderr);
    if (!result.stdout) return null;
    return JSON.parse(result.stdout).hookSpecificOutput.permissionDecisionReason;
  };
  const cloud = (name, entry) => {
    const saved = process.env.CLAUDE_CODE_REMOTE;
    process.env.CLAUDE_CODE_REMOTE = 'true';
    try {
      return record(root, name, entry, { fetch: false });
    } finally {
      process.env.CLAUDE_CODE_REMOTE = saved;
    }
  };

  git('init', '-q', '-b', 'main');
  commit('README.md');
  git('update-ref', 'refs/remotes/origin/main', 'HEAD');
  git('checkout', '-q', '-b', 'feature');
  // The stack's presence is what turns the guard on.
  commit('scripts/stack/stack.mjs', '');

  it('lets a branch that changes nothing that runs push', () => {
    commit('apps/docs/docs/guide.md');
    assert.equal(push(), null);
  });

  it('refuses a cloud session’s push of code it has not run on the stack', () => {
    commit('apps/api/src/hosts/hosts.service.ts', 'export const a = 1;\n');
    assert.match(push() ?? '', /apps\/api\/src\/hosts\/hosts\.service\.ts.*local stack.*stack\.mjs verified/);
  });

  it('asks a laptop for no stack', () => {
    assert.equal(push({ CLAUDE_CODE_REMOTE: '' }), null);
  });

  it('lets it push once it was verified, or skipped with a reason', () => {
    cloud('stack', { kind: 'verified', note: 'e2e:api green' });
    assert.equal(push(), null);
  });

  // Regression: a record taken before the last edit to the code still let it through.
  it('asks again after the code changes, not after a comment does', () => {
    write('apps/api/src/hosts/hosts.service.ts', '// why a is one\nexport const a = 1;\n');
    assert.equal(push(), null);
    write('apps/api/src/hosts/hosts.service.ts', 'export const a = 2;\n');
    assert.match(push() ?? '', /local stack/);
    cloud('stack', { kind: 'skip', note: 'a constant nobody reads yet' });
    assert.equal(push(), null);
  });

  it('refuses an agentic change (a bot’s tools) without a green eval, on any machine', () => {
    commit('apps/api/src/bots-chat/application/bot-new-tools.factory.ts', 'export const t = 1;\n');
    for (const env of [{}, { CLAUDE_CODE_REMOTE: '' }])
      assert.match(push(env) ?? '', /bot-new-tools\.factory\.ts.*evals.*pnpm eval:bot-/);
  });

  it('lets it push once an eval passed on it as it is', () => {
    // The tools factory is also code that runs: the cloud asks the stack too.
    cloud('stack', { kind: 'verified', note: 'a bot turn on the stack' });
    record(root, 'evals', { eval: 'bot-skills', args: '--runs 1' }, { fetch: false });
    assert.equal(push(), null);
    write('apps/api/src/bots-chat/application/bot-new-tools.factory.ts', 'export const t = 2;\n');
    assert.match(push({ CLAUDE_CODE_REMOTE: '' }) ?? '', /the evals/);
  });

  it('stands down when told to', () => {
    assert.equal(push({ OPPENHEIMER_VERIFY_GUARD: 'off' }), null);
  });
});
