import type { SessionDecision } from '@oppenheimer/shared';
import { answerNeedsPerson, isDestructiveDecision } from '../domain/bot-session-decision.policy';

/**
 * A bot unblocks the sessions it follows on its own, except one answer:
 * letting the agent run something destructive is the person's call, on a
 * card. What breaks this: a pattern that misses a recursive delete lets a
 * bot under Full access approve it unseen; one that catches `pnpm test`
 * sends every dialog back to the person, which is what this replaced.
 */
const permission = (detail: string, title = 'Do you want to proceed?'): SessionDecision => ({
  kind: 'permission',
  id: 'perm-1',
  title,
  detail,
  options: [
    { label: 'Yes' },
    { label: "Yes, and don't ask again for this command" },
    { label: 'No, and tell Claude what to do differently (esc)' },
  ],
});

describe('isDestructiveDecision', () => {
  it.each([
    'rm -rf ./dist ../shared',
    'rm -r build',
    'rm -fr /tmp/x',
    'rm --recursive out',
    'git push --force origin main',
    'git push -f',
    'rm build -rf',
    '/bin/rm -Rf /',
    'git clean -d -f',
    'git clean --force',
    'git reset HEAD~3 --hard',
    'git branch -D old-feature',
    'git push origin +main',
    'git branch -d -f old',
    'git branch -df old',
    'git branch -fd old',
    'git branch --delete --force old',
    'git branch -d --force old',
    'git branch -M main',
    'git push --delete origin main',
    'git push origin :main',
    'git push --mirror backup',
    'git push origin "+main"',
    "git push origin ':feat'",
    'git push "--force"',
    'rm "-rf" x',
    'git push \\\n    --force',
    'rm \\\n  -rf dir',
    'git -C /repo push --force origin main',
    'git -c core.hooksPath=/dev/null reset --hard HEAD~1',
    'git --git-dir=.git clean -fd',
    'git reset --hard HEAD~3',
    'git clean -fdx',
    'psql -c "DROP TABLE users"',
    'sudo apt-get remove nodejs',
    'find . -name "*.log" -delete',
  ])('reads %s as destructive', (command) => {
    expect(isDestructiveDecision(permission(`Bash command\n  ${command}`))).toBe(true);
  });

  it.each([
    'pnpm test',
    'rm dist/index.js',
    'git push origin feature',
    'git status',
    'git branch -d merged-feature',
    'git branch -f topic HEAD~1',
    'git push -u origin feature',
    'git checkout -b feature',
    'git push origin feature && rm -f notes.txt',
    'git clean -n',
    'git -C /repo push origin feature',
    'Edit file src/app.ts',
  ])('lets %s through to the bot', (command) => {
    expect(isDestructiveDecision(permission(`Bash command\n  ${command}`))).toBe(false);
  });

  it('reads a recursive deletion named in words', () => {
    expect(isDestructiveDecision(permission('', 'Allow recursive deletion of ./cache?'))).toBe(
      true,
    );
  });

  it('never calls a question destructive', () => {
    const question: SessionDecision = {
      kind: 'question',
      id: 'toolu_1',
      questions: [
        {
          header: null,
          question: 'Should I rm -rf the build folder?',
          multiSelect: false,
          options: [{ label: 'Yes', description: null }],
        },
      ],
    };
    expect(isDestructiveDecision(question)).toBe(false);
  });
});

describe('answerNeedsPerson', () => {
  const destructive = permission('Bash command\n  rm -rf ../shared');
  const waiting = (decision: SessionDecision | null) => ({ pendingDecision: decision });

  it('under Approve for me, puts letting a destructive dialog through to the person', () => {
    expect(
      answerNeedsPerson(waiting(destructive), { decisionId: 'perm-1', option: 0 }, 'auto'),
    ).toBe(true);
    expect(
      answerNeedsPerson(waiting(destructive), { decisionId: 'perm-1', option: 1 }, 'auto'),
    ).toBe(true);
  });

  it('under Full access, leaves every answer to the bot, destructive and unread ones included', () => {
    expect(
      answerNeedsPerson(waiting(destructive), { decisionId: 'perm-1', option: 0 }, 'full'),
    ).toBe(false);
    expect(answerNeedsPerson(null, { decisionId: 'perm-1', option: 0 }, 'full')).toBe(false);
  });

  it('under Approve for me, puts an answer to a session it could not read to the person', () => {
    expect(answerNeedsPerson(null, { decisionId: 'perm-1', option: 0 }, 'auto')).toBe(true);
  });

  it('lets the bot turn a destructive dialog down', () => {
    expect(
      answerNeedsPerson(waiting(destructive), { decisionId: 'perm-1', option: 2 }, 'auto'),
    ).toBe(false);
  });

  it('leaves an ordinary dialog to the bot', () => {
    const ordinary = permission('Bash command\n  pnpm test');
    expect(answerNeedsPerson(waiting(ordinary), { decisionId: 'perm-1', option: 0 }, 'auto')).toBe(
      false,
    );
  });

  it('leaves a stale answer to the refusal that names the current decision', () => {
    expect(
      answerNeedsPerson(waiting(destructive), { decisionId: 'perm-0', option: 0 }, 'auto'),
    ).toBe(false);
    expect(answerNeedsPerson(waiting(null), { decisionId: 'perm-1', option: 0 }, 'auto')).toBe(
      false,
    );
  });
});
