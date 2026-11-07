import { describe, expect, it } from 'vitest';
import { type ChatToolCall, type ChatTurn, SessionChat } from '../session-chat';

/**
 * A session's subagents in its chat: the host sends each subagent's own
 * lines marked as its own and one entry saying what it is
 * (`follow_subagents.go`), after the session's history and in no set order,
 * and the chat hangs each under the call that started it with its own steps.
 */

const at = (seconds: number) => new Date(Date.UTC(2026, 10, 6, 9, 0, seconds)).toISOString();

const line = (entry: Record<string, unknown>) => JSON.stringify(entry);

const prompt = (uuid: string, text: string) =>
  line({ type: 'user', uuid, timestamp: at(0), message: { role: 'user', content: text } });

const call = (uuid: string, id: string, name: string, input: Record<string, unknown>, s = 1) =>
  line({
    type: 'assistant',
    uuid,
    timestamp: at(s),
    message: {
      role: 'assistant',
      model: 'claude-opus-5-5',
      content: [{ type: 'tool_use', id, name, input }],
    },
  });

const result = (uuid: string, id: string, content: string, s = 9) =>
  line({
    type: 'user',
    uuid,
    timestamp: at(s),
    message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: id, content }] },
  });

/** One of a subagent's own lines, as the host marks it. */
const own = (agentId: string, entry: string) =>
  line({ ...JSON.parse(entry), isSidechain: true, agentId });

const subagent = (fields: Record<string, unknown>) =>
  line({ type: 'oppenheimer.subagent', state: 'running', ...fields });

function chatOf(...entries: string[]): SessionChat {
  const chat = new SessionChat();
  chat.apply({ reset: true, history: 'end', entries });
  return chat;
}

function callsOf(turn: ChatTurn | undefined): ChatToolCall[] {
  return (turn?.steps ?? []).flatMap((step) => (step.kind === 'tool' ? [step.call] : []));
}

describe('a session chat with subagents', () => {
  it("hangs a Claude Code subagent's own work under the Agent call that started it, live", () => {
    const chat = chatOf(
      prompt('u1', 'Where is the repo picker?'),
      call('a1', 'toolu_agent', 'Agent', { description: 'Find it', subagent_type: 'Explore' }),
    );
    // The history is in; the subagent arrives after it, its lines before its entry.
    chat.apply({
      entries: [
        own('ag1', prompt('s1', 'Find the repo picker')),
        own('ag1', call('s2', 'toolu_grep', 'Grep', { pattern: 'RepoPicker' }, 2)),
        subagent({ id: 'ag1', parentToolUseId: 'toolu_agent', agentType: 'Explore' }),
      ],
    });

    const [turn] = chat.snapshot().turns;
    // Its lines are its own, never the session's.
    expect(callsOf(turn).map((c) => c.name)).toEqual(['Agent']);
    const started = callsOf(turn)[0]?.subagent;
    expect(started).toMatchObject({ id: 'ag1', type: 'Explore', state: 'running', calls: 1 });
    expect(started?.steps.map((step) => step.kind)).toEqual(['tool']);
    expect(started?.model).toBe('claude-opus-5-5');

    chat.apply({
      entries: [
        own('ag1', result('s3', 'toolu_grep', 'src/repo-picker.tsx', 3)),
        subagent({
          id: 'ag1',
          parentToolUseId: 'toolu_agent',
          agentType: 'Explore',
          state: 'completed',
        }),
      ],
    });
    const finished = callsOf(chat.snapshot().turns[0])[0]?.subagent;
    expect(finished?.state).toBe('completed');
    const grep = finished?.steps[0];
    expect(grep?.kind === 'tool' && grep.call.output).toBe('src/repo-picker.tsx');
  });

  it("finds a Codex subagent's spawn_agent call by the thread or the task its answer names", () => {
    const chat = chatOf(
      prompt('u1', 'Review the wallet'),
      call('a1', 'call_v1', 'spawn_agent', { message: 'Read the tests', agent_type: 'explorer' }),
      result('r1', 'call_v1', '{"agent_id":"thr-ada","nickname":"Ada"}', 2),
      call('a2', 'call_v2', 'spawn_agent', { message: 'Check types', task_name: 'checker' }, 3),
      result('r2', 'call_v2', '{"task_name":"checker"}', 4),
      subagent({ id: 'thr-ada', name: 'Ada', agentType: 'explorer', tokens: 31000 }),
      subagent({ id: 'thr-chk', path: '/root/checker', state: 'stopped' }),
    );
    const [v1, v2] = callsOf(chat.snapshot().turns[0]);
    expect(v1?.kind).toBe('agent');
    expect(v1?.subagent).toMatchObject({ id: 'thr-ada', name: 'Ada', tokens: 31000 });
    expect(v2?.subagent).toMatchObject({ id: 'thr-chk', state: 'stopped' });
  });

  it("hangs a subagent's own subagent under its call, and redraws only the turn they work in", () => {
    const chat = chatOf(
      prompt('u1', 'First'),
      line({
        type: 'assistant',
        uuid: 'a0',
        timestamp: at(1),
        message: { role: 'assistant', content: [{ type: 'text', text: 'Done.' }] },
      }),
      prompt('u2', 'Second'),
      call('a1', 'toolu_outer', 'Agent', { description: 'Outer' }),
      own('outer', call('o1', 'toolu_inner', 'Agent', { description: 'Inner' })),
      subagent({ id: 'outer', parentToolUseId: 'toolu_outer' }),
      subagent({ id: 'inner', parentToolUseId: 'toolu_inner' }),
    );
    const [first, second] = chat.snapshot().turns;
    const outer = callsOf(second)[0]?.subagent;
    const inner = outer?.steps[0];
    expect(inner?.kind === 'tool' && inner.call.subagent?.id).toBe('inner');

    chat.apply({ entries: [own('inner', call('i1', 'toolu_ls', 'Glob', { pattern: '*' }))] });
    const [firstAfter, secondAfter] = chat.snapshot().turns;
    expect(firstAfter).toBe(first);
    expect(secondAfter).not.toBe(second);
  });

  // Regression: a subagent was kept by its own version alone, so its own
  // subagent's work froze once the parent stopped writing (still running).
  it("follows a subagent's own subagent after its parent has gone quiet", () => {
    const chat = chatOf(
      prompt('u1', 'Go'),
      call('a1', 'toolu_outer', 'Agent', { description: 'Outer' }),
      own('outer', call('o1', 'toolu_inner', 'Agent', { description: 'Inner' })),
      subagent({ id: 'outer', parentToolUseId: 'toolu_outer', state: 'completed' }),
      subagent({ id: 'inner', parentToolUseId: 'toolu_inner' }),
    );
    const innerOf = () => {
      const outer = callsOf(chat.snapshot().turns[0])[0]?.subagent;
      const step = outer?.steps[0];
      return step?.kind === 'tool' ? step.call.subagent : null;
    };
    expect(innerOf()?.state).toBe('running');

    chat.apply({
      entries: [
        own('inner', call('i1', 'toolu_ls', 'Glob', { pattern: '*' })),
        subagent({ id: 'inner', parentToolUseId: 'toolu_inner', state: 'completed' }),
      ],
    });
    expect(innerOf()).toMatchObject({ state: 'completed', calls: 1 });
  });

  it('holds each subagent line once when a reconnect sends them again', () => {
    const entries = [
      prompt('u1', 'Go'),
      call('a1', 'toolu_agent', 'Agent', { description: 'Look' }),
      own('ag1', call('s1', 'toolu_ls', 'Glob', { pattern: '*' })),
      subagent({ id: 'ag1', parentToolUseId: 'toolu_agent' }),
    ];
    const chat = chatOf(...entries);
    chat.apply({ reset: true, history: 'end', entries });
    expect(callsOf(chat.snapshot().turns[0])[0]?.subagent?.steps).toHaveLength(1);
  });
});
