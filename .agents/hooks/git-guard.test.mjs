// The git guard's policy, case by case: what it refuses however the command
// is spelled (global options, quotes, `--`, chained commands), and what it
// lets through. The last block runs the hook as Claude Code does, with the
// tool call on stdin.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { commands, gitInvocation, verdict } from './git-guard.mjs';

const HOOK = fileURLToPath(new URL('./git-guard.mjs', import.meta.url));

const blocked = [
  // pushes to main or master
  'git push origin main',
  'git push origin master',
  'git push origin HEAD:main',
  'git push origin feature:refs/heads/main',
  'git push -u origin main',
  'git push origin main --tags',
  'git -C repo push origin main',
  'git -c http.extraHeader=x push origin main',
  'git -c x=y push origin main',
  'git --git-dir=.git --work-tree=. push origin main',
  'git --no-pager push origin main',
  'git push -o ci.skip origin main',
  'git push --all origin',
  'git push --mirror origin',
  'cd repo && git push origin main',
  'npm test || git push origin main',
  'echo done; git push origin main',
  'GIT_TRACE=1 git push origin main',
  'env GIT_TRACE=1 git push origin main',
  '/usr/bin/git push origin main',
  "git push origin 'main'",
  'git push origin "HEAD:master"',
  '(cd repo && git push origin main)',
  'echo $(git push origin main)',
  // force pushes and remote deletes
  'git push --force origin feature',
  'git push -f origin feature',
  'git push -uf origin feature',
  'git push --force-with-lease origin feature',
  'git push --force-with-lease=feature:abc origin feature',
  'git -C repo push --force origin feature',
  'git push origin +feature',
  'git push origin --delete feature',
  'git push -d origin feature',
  'git push origin :feature',
  // destroying work
  'git reset --hard',
  'git reset --hard HEAD~1',
  'git -C repo reset --hard origin/main',
  'git branch -D feature',
  'git branch -vD feature',
  'git branch --delete --force feature',
  'git branch -d -f feature',
  // staging everything
  'git add -A',
  'git add --all',
  'git add .',
  'git add ./',
  'git add *',
  'git add :/',
  "git add ':(top)'",
  'git add -- .',
  'git add -Av',
  'git -C repo add -A',
  'git -C "my repo" add .',
  'git stage -A',
  'git add src/a.ts && git add -A',
  'git add "."',
  // env files
  'git add .env',
  'git add -- .env',
  'git add apps/api/.env.local',
  'git add .env.production',
  "git add '.env'",
  'git add .env*',
  'git -C repo add -- config/.env',
];

const allowed = [
  'git push origin feature',
  'git push -u origin claude/eloquent-goodall-n9o3ur',
  'git push origin HEAD',
  'git push origin main-fixes',
  'git push origin feature:feature',
  'git push',
  'git -C repo push origin feature',
  'git pull origin main',
  'git fetch origin main',
  'git checkout main',
  'git log --oneline origin/main..HEAD',
  'git diff main -- .',
  'git reset --soft HEAD~1',
  'git reset HEAD src/a.ts',
  'git branch -d merged-feature',
  'git branch feature',
  'git add src/a.ts src/b.ts',
  'git add -- src/a.ts',
  'git add .env.example',
  'git add apps/api/.env.example',
  'git add .github/workflows/ci.yml',
  'git add ./src/a.ts',
  'git -C repo add src/a.ts',
  'git commit -m "git add -A is not allowed; git push origin main neither"',
  "echo 'git push origin main'",
  'grep -rn "git add ." docs',
  'gitk --all',
  'echo git add -A',
  'ls # git add -A',
];

describe('git guard', () => {
  for (const command of blocked) {
    it(`refuses: ${command}`, () => {
      assert.ok(verdict(command), `expected a refusal for ${command}`);
    });
  }

  for (const command of allowed) {
    it(`lets through: ${command}`, () => {
      assert.equal(verdict(command), undefined);
    });
  }

  it('finds the subcommand behind the global options', () => {
    assert.deepEqual(
      gitInvocation(['git', '-C', 'repo', '-c', 'a=b', '--no-pager', 'add', '-A']),
      { subcommand: 'add', args: ['-A'] },
    );
    assert.equal(gitInvocation(['gitk', '--all']), undefined);
  });

  it('splits a line into its simple commands, quotes kept together', () => {
    assert.deepEqual(commands(`cd 'my repo' && git add "a b.ts"; git status | head`), [
      ['cd', 'my repo'],
      ['git', 'add', 'a b.ts'],
      ['git', 'status'],
      ['head'],
    ]);
  });
});

describe('git guard as a hook', () => {
  const run = (command) =>
    spawnSync(process.execPath, [HOOK], {
      input: JSON.stringify({ tool_input: { command } }),
      encoding: 'utf8',
    });

  it('blocks with exit 2 and says why on stderr', () => {
    const result = run('git -C repo add -A');
    assert.equal(result.status, 2);
    assert.match(result.stderr, /^BLOCKED: Do not stage everything/);
  });

  it('lets an allowed command through with exit 0 and says nothing', () => {
    const result = run('git add src/a.ts');
    assert.equal(result.status, 0);
    assert.equal(result.stderr, '');
  });

  it('lets through input it cannot read rather than failing every shell call', () => {
    const result = spawnSync(process.execPath, [HOOK], { input: 'not json', encoding: 'utf8' });
    assert.equal(result.status, 0);
  });
});
