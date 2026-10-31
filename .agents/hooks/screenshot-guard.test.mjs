// The screenshot guard's policy: which paths count as a visual change
// (`visual-change.mjs`), which tool calls publish a branch, and when one is
// refused for its screenshots. The last block runs the hook as Claude Code
// does, on a throwaway repository with an `origin/main`.
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { publishes } from './screenshot-guard.mjs';
import { isVisual, visualChange } from './visual-change.mjs';

const HOOK = fileURLToPath(new URL('./screenshot-guard.mjs', import.meta.url));

describe('publishes', () => {
  const bash = (command) => publishes('Bash', { command }, '/work/a')[0] ?? null;
  for (const command of [
    'git push',
    'git push -u origin claude/feature',
    'git -C repo push origin feature',
    'cd repo && git push origin feature',
    'npm test && GIT_TRACE=1 git push',
    'gh pr create --title x --body y',
    'gh pr edit 12 --body-file pr.md',
    'gh -R owner/repo pr create',
  ])
    it(`gates ${command}`, () => assert.notEqual(bash(command), null));

  for (const command of [
    'git status',
    'git commit -m "push the button"',
    'echo git push',
    'gh pr view 12',
    'gh pr list',
    'pnpm screens /sessions',
  ])
    it(`lets ${command} run`, () => assert.equal(bash(command), null));

  for (const tool of [
    'mcp__github__create_pull_request',
    'mcp__github__update_pull_request',
    'mcp__plugin_engineering_github__create_pull_request',
  ])
    it(`gates ${tool}`, () => assert.equal(publishes(tool, {}, '/work/a').length, 1));

  for (const tool of ['mcp__github__pull_request_read', 'mcp__github__list_pull_requests', 'Edit'])
    it(`lets ${tool} run`, () => assert.deepEqual(publishes(tool, {}, '/work/a'), []));

  it('checks the checkout each command publishes from', () => {
    const from = (command) => publishes('Bash', { command }, '/work/a').map((t) => t.directory);
    assert.deepEqual(from('git push'), ['/work/a']);
    assert.deepEqual(from('cd ../b && git push'), ['/work/b']);
    assert.deepEqual(from('git -C ../c push'), ['/work/c']);
    assert.deepEqual(from('cd ../b && git -C sub push && gh pr create'), ['/work/b/sub', '/work/b']);
  });

  it('falls back to the session’s checkout where the line does not say', () => {
    const from = (command) => publishes('Bash', { command }, '/work/a').map((t) => t.directory);
    assert.deepEqual(from('cd "$WORKTREE" && git push'), ['/work/a']);
  });
});

// oppenheimer:begin web
describe('isVisual', () => {
  for (const path of [
    'apps/web/src/features/hosts/sections/host-list.tsx',
    'apps/web/src/routes/_authenticated/sessions.tsx',
    'apps/web/src/styles.css',
    'apps/web/public/theme-init.js',
    'apps/web/index.html',
    'packages/frontend/web/src/shell/components/sidebar.tsx',
    'packages/frontend/design-system/web/src/components/badge.tsx',
    'packages/frontend/design-system/web/src/styles/globals.css',
    'packages/translations/en/index.json',
    'packages/translations/locales.ts',
  ])
    it(`counts ${path}`, () => assert.equal(isVisual(path), true));

  for (const path of [
    'apps/web/src/features/hosts/__tests__/host-list.spec.tsx',
    'apps/web/src/lib/format.test.ts',
    'packages/frontend/design-system/web/src/components/badge.stories.tsx',
    'apps/web/src/features/README.md',
    'apps/web/vite.config.ts',
    'apps/api/src/hosts/hosts.controller.ts',
    'packages/frontend/consumer/src/modules/hosts/hooks/use-hosts.ts',
    'packages/shared/src/schemas/hosts.schema.ts',
    'docs/screens.md',
    'packages/translations/scripts/assemble.mjs',
  ])
    it(`skips ${path}`, () => assert.equal(isVisual(path), false));
});

describe('the hook', () => {
  const root = mkdtempSync(join(tmpdir(), 'screenshot-guard-'));
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
  /** The hook's answer to a tool call: `{ decision, reason }`, or null when it may run. */
  const call = (input = { tool_name: 'Bash', tool_input: { command: 'git push' } }, env = {}) => {
    const result = spawnSync('node', [HOOK], {
      cwd: root,
      env: { ...process.env, OPPENHEIMER_SCREENSHOT_GUARD: '', ...env },
      input: JSON.stringify({ cwd: root, hook_event_name: 'PreToolUse', ...input }),
      encoding: 'utf8',
    });
    assert.equal(result.status, 0, result.stderr);
    if (!result.stdout) return null;
    const { permissionDecision, permissionDecisionReason } =
      JSON.parse(result.stdout).hookSpecificOutput;
    return { decision: permissionDecision, reason: permissionDecisionReason };
  };
  const push = () => call()?.decision ?? null;

  git('init', '-q', '-b', 'main');
  write('README.md');
  git('add', 'README.md');
  git('commit', '-q', '-m', 'init');
  git('update-ref', 'refs/remotes/origin/main', 'HEAD');
  git('checkout', '-q', '-b', 'feature');
  // The camera's presence is what turns the guard on.
  write('scripts/stack/screens.mjs', '');
  git('add', 'scripts/stack/screens.mjs');
  git('commit', '-q', '-m', 'camera');

  it('lets a branch with no visual change push', () => {
    write('apps/api/src/x.ts');
    git('add', 'apps/api/src/x.ts');
    git('commit', '-q', '-m', 'api');
    assert.equal(push(), null);
  });

  it('refuses to push an uncommitted visual change', () => {
    write('apps/web/src/features/hosts/sections/list.tsx');
    const refused = call();
    assert.equal(refused?.decision, 'deny');
    assert.match(refused.reason, /apps\/web\/src\/features\/hosts\/sections\/list\.tsx/);
  });

  it('refuses to open its pull request, by gh or by the GitHub MCP tool', () => {
    const gh = { tool_name: 'Bash', tool_input: { command: 'gh pr create --fill' } };
    const mcp = { tool_name: 'mcp__github__create_pull_request', tool_input: { head: 'feature' } };
    assert.equal(call(gh)?.decision, 'deny');
    assert.equal(call(mcp)?.decision, 'deny');
  });

  describe('from another checkout', () => {
    // A worktree on a branch with no visual change, beside the one that has it.
    const clean = mkdtempSync(join(tmpdir(), 'screenshot-guard-clean-'));
    after(() => rmSync(clean, { recursive: true, force: true }));
    const pushIn = (cwd, command) =>
      call({ cwd, tool_name: 'Bash', tool_input: { command } })?.decision ?? null;
    const prFrom = (cwd, head) =>
      call({ cwd, tool_name: 'mcp__github__create_pull_request', tool_input: { head } })
        ?.decision ?? null;

    it('refuses `cd <visual checkout> && git push` from a clean one', () => {
      rmSync(clean, { recursive: true, force: true });
      git('worktree', 'add', '-q', '-b', 'clean', clean, 'HEAD');
      assert.equal(pushIn(clean, 'git push'), null);
      assert.equal(pushIn(clean, `cd ${root} && git push`), 'deny');
      assert.equal(pushIn(clean, `git -C ${root} push`), 'deny');
    });

    it('lets a clean checkout push from the visual one’s session', () => {
      assert.equal(pushIn(root, `cd ${clean} && git push`), null);
      assert.equal(pushIn(root, `git -C ${clean} push`), null);
    });

    it('checks the worktree that has the pull request’s head', () => {
      assert.equal(prFrom(clean, 'feature'), 'deny');
      assert.equal(prFrom(root, 'owner:clean'), null);
    });
  });

  it('lets every other call run on the same branch, so no turn is held', () => {
    assert.equal(call({ tool_name: 'Bash', tool_input: { command: 'git status' } }), null);
    assert.equal(call({ tool_name: 'Edit', tool_input: { file_path: 'x' } }), null);
  });

  it('lets a run that turns the guard off push (the audit eval)', () => {
    assert.equal(call(undefined, { OPPENHEIMER_SCREENSHOT_GUARD: 'off' }), null);
  });

  it('refuses a committed one too', () => {
    git('add', 'apps/web/src/features/hosts/sections/list.tsx');
    git('commit', '-q', '-m', 'web');
    assert.equal(push(), 'deny');
  });

  const current = () => visualChange(root, { fetch: false }).fingerprint;

  it('is not answered by screenshots of other code', () => {
    write('.screenshots/manifest.json', JSON.stringify({ fingerprint: '0123456789abcdef' }));
    assert.equal(push(), 'deny');
  });

  it('is answered by screenshots of the code as it is', () => {
    write('.screenshots/manifest.json', JSON.stringify({ fingerprint: current() }, null, 2));
    assert.equal(push(), null);
  });

  it('stays answered by a commit, a touch or a checkout that changes no content', () => {
    git('commit', '-q', '--allow-empty', '-m', 'later commit');
    utimesSync(join(root, 'apps/web/src/features/hosts/sections/list.tsx'), new Date(), new Date());
    assert.equal(push(), null);
  });

  it('refuses again once a visual file changes', () => {
    write('apps/web/src/features/hosts/sections/list.tsx', 'y');
    assert.equal(push(), 'deny');
  });

  it('is answered by a not-visual note for the code as it is', () => {
    write('.screenshots/not-visual.md', `renamed a prop\n\nfingerprint: ${current()}\n`);
    assert.equal(push(), null);
  });

  it('refuses an uncommitted deletion of a visual file', () => {
    git('add', '-A', 'apps');
    git('commit', '-q', '-m', 'list');
    write('.screenshots/manifest.json', JSON.stringify({ fingerprint: current() }));
    assert.equal(push(), null);
    rmSync(join(root, 'apps/web/src/features/hosts/sections/list.tsx'));
    assert.equal(push(), 'deny');
  });

  it('stays out of a checkout with no camera', () => {
    rmSync(join(root, 'scripts/stack/screens.mjs'));
    assert.equal(push(), null);
    git('checkout', '-q', '--', 'scripts/stack/screens.mjs');
  });

  it('compares against main when origin/main is older than it', () => {
    git('checkout', '-q', '-f', 'main');
    git('clean', '-fdq');
    write('apps/web/src/on-main.tsx', 'main');
    git('add', 'apps/web/src/on-main.tsx');
    git('commit', '-q', '-m', 'main moved on');
    git('checkout', '-q', '-b', 'fresh');
    rmSync(join(root, '.screenshots'), { recursive: true, force: true });
    assert.equal(push(), null);
  });

  it('stays out of a repository with no main', () => {
    git('update-ref', '-d', 'refs/remotes/origin/main');
    git('branch', '-q', '-m', 'main', 'trunk');
    assert.equal(push(), null);
  });
});
// oppenheimer:end web
