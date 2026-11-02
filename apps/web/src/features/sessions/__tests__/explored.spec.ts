import { type ChatToolCall, SessionChat } from '@oppenheimer/frontend-consumer';
import { describe, expect, it } from 'vitest';
import { blocksOf } from '../lib/chat-blocks';
import { exploredPartsOf, exploringCommand } from '../lib/explored';

/**
 * Which of the agent's calls fold into an Explored group, and what its line
 * names. What breaks this: a command that writes (`sed -i`, `find -delete`,
 * a redirect) folded in as though it only looked, so the line hides a
 * change; a run that an edit or a reply should end carried past it; a file
 * read twice named twice.
 */

const tool = (id: string, name: string, input: Record<string, unknown> = {}) => ({
  type: 'tool_use',
  id,
  name,
  input,
});

function turnOf(content: unknown[], after: unknown[] = []) {
  const chat = new SessionChat();
  chat.apply({
    reset: true,
    entries: [
      { type: 'user', uuid: 'u', message: { role: 'user', content: 'Go' } },
      { type: 'assistant', uuid: 'a', message: { role: 'assistant', content } },
      ...after.map((content, index) => ({
        type: 'assistant',
        uuid: `b${index}`,
        message: { role: 'assistant', content },
      })),
    ].map((entry) => JSON.stringify(entry)),
  });
  const turn = chat.snapshot().turns[0];
  if (!turn) throw new Error('no turn');
  return turn;
}

const shapeOf = (content: unknown[], after: unknown[] = []) =>
  blocksOf(turnOf(content, after)).map((block) =>
    'calls' in block ? `${block.kind}:${block.calls.map((call) => call.id).join(',')}` : block.kind,
  );

describe('exploringCommand', () => {
  it.each([
    ['ls -la src', [{ verb: 'list', target: 'src' }]],
    ['ls', [{ verb: 'list', target: '.' }]],
    [
      'cat a.ts b.ts',
      [
        { verb: 'read', target: 'a.ts' },
        { verb: 'read', target: 'b.ts' },
      ],
    ],
    ['head -n 40 src/main.ts', [{ verb: 'read', target: 'src/main.ts' }]],
    ["sed -n '1,80p' src/app.tsx", [{ verb: 'read', target: 'src/app.tsx' }]],
    ['rg -n "abortSignal" packages', [{ verb: 'search', target: 'abortSignal' }]],
    ['grep -rn -e TODO src | head -20', [{ verb: 'search', target: 'TODO' }]],
    ['git grep cancel', [{ verb: 'search', target: 'cancel' }]],
    ["find src -name '*.ts' -type f", [{ verb: 'list', target: 'src' }]],
    ['tree -L 2 apps', [{ verb: 'list', target: 'apps' }]],
    ['cd apps/web && rg useChat', [{ verb: 'search', target: 'useChat' }]],
  ])('reads %s as looking around', (command, targets) => {
    const found = exploringCommand(command)?.map(({ verb, key }) => ({ verb, target: key }));
    expect(found).toEqual(targets);
  });

  it.each([
    'pnpm test',
    "sed -i 's/a/b/' a.ts",
    'find . -name "*.log" -delete',
    'find . -exec rm {} ;',
    'cat a.ts > b.ts',
    'rg foo | xargs rm',
    'ls && rm -rf dist',
    'echo $(cat secret)',
    'cat "unterminated',
    'cd apps/web',
    'sleep 5 &',
    'cat a.ts\nrm b.ts',
    'ls; rm -rf dist',
    "find . -name '*.ts' 2>/dev/null",
    'find . -newer a.ts',
    'rg -i foo',
    'cat a.ts | tee b.ts',
  ])('leaves %s out, since it does more than look', (command) => {
    expect(exploringCommand(command)).toBeNull();
  });
});

describe('the Explored run', () => {
  it('takes reads, searches, listings and read-only commands as one run', () => {
    expect(
      shapeOf([
        tool('1', 'Read', { file_path: 'a.ts' }),
        tool('2', 'Grep', { pattern: 'x' }),
        tool('3', 'Glob', { pattern: '**/*.ts' }),
        tool('4', 'LS', { path: 'src' }),
        tool('5', 'Bash', { command: 'rg foo' }),
      ]),
    ).toEqual(['explored:1,2,3,4,5']);
  });

  it('ends at a call that is not a read, and starts again after it', () => {
    expect(
      shapeOf([
        tool('1', 'Read', { file_path: 'a.ts' }),
        tool('2', 'Edit', { file_path: 'a.ts' }),
        tool('3', 'Bash', { command: 'pnpm test' }),
        tool('4', 'Read', { file_path: 'b.ts' }),
        tool('5', 'Bash', { command: "sed -i 's/a/b/' b.ts" }),
      ]),
    ).toEqual(['explored:1', 'tools:2,3', 'explored:4', 'tools:5']);
  });

  it('ends at what the agent said or thought between two reads', () => {
    expect(
      shapeOf(
        [tool('1', 'Read', { file_path: 'a.ts' })],
        [
          [{ type: 'text', text: 'Now the other one.' }],
          [tool('2', 'Read', { file_path: 'b.ts' })],
        ],
      ),
    ).toEqual(['explored:1', 'reply', 'explored:2']);
  });

  it('runs on past a task list the agent rewrote', () => {
    expect(
      shapeOf([
        tool('1', 'Read', { file_path: 'a.ts' }),
        tool('t', 'TodoWrite', { todos: [] }),
        tool('2', 'Read', { file_path: 'b.ts' }),
      ]),
    ).toEqual(['explored:1,2']);
  });
});

describe('exploredParts', () => {
  const calls = (content: unknown[]) =>
    turnOf(content).steps.flatMap((step) =>
      step.kind === 'tool' ? [step.call] : [],
    ) as ChatToolCall[];

  it('names each file once, by its name, however it was read, and each verb in the order it came', () => {
    expect(
      exploredPartsOf(
        calls([
          tool('1', 'Read', { file_path: '/repo/src/a.ts' }),
          tool('2', 'Grep', { pattern: 'cancel' }),
          tool('3', 'Bash', { command: 'cat /repo/src/a.ts' }),
          tool('4', 'Read', { file_path: '/repo/src/b.ts' }),
          tool('5', 'Grep', { pattern: 'cancel' }),
          tool('6', 'LS', { path: 'src' }),
        ]),
      ),
    ).toEqual([
      { verb: 'read', targets: ['a.ts', 'b.ts'] },
      { verb: 'search', targets: ['cancel'] },
      { verb: 'list', targets: ['src'] },
    ]);
  });
});
