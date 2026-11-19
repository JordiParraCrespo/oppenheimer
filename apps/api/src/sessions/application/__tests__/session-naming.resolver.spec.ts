import type { ConfigService } from '@nestjs/config';
import { LlmError, type LlmService } from '@oppenheimer/backend-llm';
import { describe, expect, it, vi } from 'vitest';
import type { WorkSessionRepositoryPort } from '../../database/work-session.repository.port';
import type { SessionFold } from '../../domain/session-state.policy';
import type { WorkSessionEntity } from '../../domain/work-session.entity';
import type { WorkSessionEventEntity } from '../../domain/work-session-event.entity';
import { SessionNamingResolver } from '../session-naming.resolver';
import type { SessionTranscriptOutcome, SessionTranscriptPort } from '../session-transcript.port';

/**
 * Model first, the prompt's own words when the model is not there or not quick:
 * either way a session with a first prompt stops being called by its slug.
 */
type NameSource = 'user' | 'model' | 'prompt' | 'conversation' | null;

function session(nameSource: NameSource = null): WorkSessionEntity {
  return {
    id: 'session-1',
    slug: 'bold-otter-3f9a7k',
    hostId: 'host-1',
    place: 'host',
    nameSource,
  } as WorkSessionEntity;
}

function llm(
  complete: LlmService['complete'],
  { configured = true, defaultModel = 'default-model' } = {},
): LlmService {
  return {
    isConfigured: () => configured,
    defaultModel,
    complete: vi.fn(complete),
  } as unknown as LlmService;
}

const answer = (text: string) => async () => ({
  text,
  model: 'a-small-model',
  provider: 'openrouter' as const,
  finishReason: 'stop',
  usage: null,
});

function config(values: Record<string, unknown> = {}): ConfigService {
  const all: Record<string, unknown> = { 'sessions.namerTimeoutMs': 1_500, ...values };
  return { get: (key: string) => all[key] } as ConfigService;
}

function repository(): WorkSessionRepositoryPort {
  return {
    appendEvents: vi.fn().mockResolvedValue({}),
    appendEventsIf: vi.fn().mockResolvedValue({}),
  } as unknown as WorkSessionRepositoryPort;
}

/** Claude Code's transcript lines, as the runner hands them over. */
const line = (role: 'user' | 'assistant', content: unknown, flags: Record<string, boolean> = {}) =>
  JSON.stringify({
    type: role,
    uuid: `${role}-${Math.random()}`,
    ...flags,
    message: { role, content },
  });

function transcript(...entries: string[]): SessionTranscriptPort {
  const outcome: SessionTranscriptOutcome = {
    kind: 'page',
    page: { entries, from: 0, next: 0, atEnd: true, conversation: 'c1' },
  };
  return { read: vi.fn().mockResolvedValue(outcome) };
}

const noTranscript = (): SessionTranscriptPort => ({ read: vi.fn() });

const resolverWith = (client: LlmService, values?: Record<string, unknown>) =>
  new SessionNamingResolver(repository(), noTranscript(), client, config(values));

describe('SessionNamingResolver.propose', () => {
  it('takes the model’s title, asked within the naming deadline', async () => {
    const client = llm(answer('<think>ok</think>\n"Wallet empty state."'));

    await expect(
      resolverWith(client, { 'sessions.namerModel': 'a-small-model' }).propose(
        session(),
        'the wallet list shows nothing when there are no wallets',
      ),
    ).resolves.toEqual({ name: 'Wallet empty state', source: 'model' });

    expect(client.complete).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'a-small-model',
        timeoutMs: 1_500,
        temperature: 0,
        messages: [
          { role: 'user', content: 'the wallet list shows nothing when there are no wallets' },
        ],
      }),
    );
  });

  it('asks the provider’s default model when naming names none of its own', async () => {
    const client = llm(answer('A title'));
    await resolverWith(client).propose(session(), 'anything');
    expect(vi.mocked(client.complete).mock.calls[0][0].model).toBe('default-model');
  });

  it('falls back to the prompt’s own words when the model is not quick', async () => {
    const client = llm(async () => {
      throw new LlmError('timeout', 'openrouter', 'openrouter did not answer within 1500ms');
    });
    await expect(
      resolverWith(client).propose(
        session(),
        'can you fix the wallet list empty state on mobile please',
      ),
    ).resolves.toEqual({ name: 'Fix the wallet list empty state', source: 'prompt' });
  });

  it('falls back when the model answers with nothing usable', async () => {
    await expect(
      resolverWith(llm(answer('<think>hmm</think>'))).propose(session(), 'add dark mode'),
    ).resolves.toEqual({ name: 'Add dark mode', source: 'prompt' });
  });

  it('makes no call when no model names sessions here', async () => {
    const unconfigured = llm(answer('never'), { configured: false });
    await expect(resolverWith(unconfigured).propose(session(), 'add dark mode')).resolves.toEqual({
      name: 'Add dark mode',
      source: 'prompt',
    });
    expect(unconfigured.complete).not.toHaveBeenCalled();

    const noModel = llm(answer('never'), { defaultModel: '' });
    await resolverWith(noModel).propose(session(), 'add dark mode');
    expect(noModel.complete).not.toHaveBeenCalled();
  });

  it('proposes nothing for a session somebody already named', async () => {
    const client = llm(answer('never'));
    await expect(
      resolverWith(client).propose(session('user'), 'add dark mode'),
    ).resolves.toBeNull();
    expect(client.complete).not.toHaveBeenCalled();
  });
});

describe('SessionNamingResolver.record', () => {
  it('records the proposal with who chose it, keyed on the prompt', async () => {
    const sessions = repository();
    const resolver = new SessionNamingResolver(
      sessions,
      noTranscript(),
      llm(answer('x')),
      config(),
    );

    await resolver.record(session(), { name: 'Add dark mode', source: 'prompt' }, 'cmd-1:prompt');

    expect(sessions.appendEvents).toHaveBeenCalledWith(expect.anything(), [
      {
        idempotencyKey: 'session.named:cmd-1:prompt',
        source: 'api',
        kind: 'session.named',
        payload: { name: 'Add dark mode', source: 'prompt' },
      },
    ]);
  });

  it('never fails the caller over a name it could not write', async () => {
    const sessions = repository();
    vi.mocked(sessions.appendEvents).mockRejectedValue(new Error('lock timeout'));
    const resolver = new SessionNamingResolver(
      sessions,
      noTranscript(),
      llm(answer('x')),
      config(),
    );

    await expect(
      resolver.record(session(), { name: 'Add dark mode', source: 'prompt' }, 'k'),
    ).resolves.toBeUndefined();
  });
});

/**
 * Once the person has asked a second thing and the agent has answered, the title
 * is written again from everything they asked, unless they named it themselves.
 */
describe('SessionNamingResolver.nameFromBatch', () => {
  const answered = [
    { kind: 'agent.observed', payload: { state: 'idle' } },
  ] as unknown as WorkSessionEventEntity[];

  const twoPrompts = () =>
    transcript(
      line('user', 'fix the bug'),
      line('assistant', [{ type: 'text', text: 'Which bug?' }]),
      line('user', [{ type: 'tool_result', tool_use_id: 't', content: 'ok' }]),
      line('user', '<command-name>/clear</command-name>'),
      line(
        'user',
        'the wallet list is empty on mobile when sk-ant-abcdefghijklmnopqrstuvwxyz is set',
      ),
    );

  it('renames a derived title from the person’s prompts, conditional on it still being derived', async () => {
    const sessions = repository();
    const client = llm(answer('Wallet list empty on mobile'));
    const resolver = new SessionNamingResolver(sessions, twoPrompts(), client, config());

    await resolver.nameFromBatch(session('model'), answered);

    const request = vi.mocked(client.complete).mock.calls[0][0];
    const sent = request.messages[0].content;
    expect(sent).toContain('1. fix the bug');
    expect(sent).toContain('2. the wallet list is empty on mobile');
    // Only what the person wrote leaves the host, with secrets taken out.
    expect(sent).not.toContain('Which bug?');
    expect(sent).not.toContain('/clear');
    expect(sent).not.toContain('sk-ant-');

    const [, events, holds] = vi.mocked(sessions.appendEventsIf).mock.calls[0];
    expect(events).toEqual([
      {
        idempotencyKey: 'session.named:conversation',
        source: 'api',
        kind: 'session.named',
        payload: { name: 'Wallet list empty on mobile', source: 'conversation' },
      },
    ]);
    // A rename typed while the model was thinking wins.
    expect(holds({ nameSource: 'user' } as SessionFold, null)).toBe(false);
    expect(holds({ nameSource: 'prompt' } as SessionFold, null)).toBe(true);
  });

  it('counts only what the person typed: not an interruption, a caveat, a skill’s body or a subagent', async () => {
    const sessions = repository();
    const client = llm(answer('never'));
    const noise = transcript(
      line('user', 'fix the bug'),
      line('user', [{ type: 'text', text: '[Request interrupted by user]' }]),
      line(
        'user',
        'Caveat: The messages below were generated by the user while running local commands.',
      ),
      line('user', 'Base directory for this skill: /x\n\n# Review', { isMeta: true }),
      line('user', 'Search the repo for the wallet list', { isSidechain: true }),
      line('user', 'This session is being continued from a previous one.', {
        isCompactSummary: true,
      }),
    );
    await new SessionNamingResolver(sessions, noise, client, config()).nameFromBatch(
      session('model'),
      answered,
    );
    expect(client.complete).not.toHaveBeenCalled();
    expect(sessions.appendEventsIf).not.toHaveBeenCalled();
  });

  it('reads on past a long first answer to find the second prompt', async () => {
    const page = (entries: string[], from: number, atEnd: boolean): SessionTranscriptOutcome => ({
      kind: 'page',
      page: { entries, from, next: from + 1, atEnd, conversation: 'c1' },
    });
    const reader: SessionTranscriptPort = {
      read: vi
        .fn()
        .mockResolvedValueOnce(
          page([line('user', 'fix the bug'), line('assistant', 'Looking.')], 0, false),
        )
        .mockResolvedValueOnce(page([line('user', 'the wallet list one')], 1, true)),
    };
    const sessions = repository();
    await new SessionNamingResolver(
      sessions,
      reader,
      llm(answer('Wallet list')),
      config(),
    ).nameFromBatch(session('model'), answered);
    expect(vi.mocked(reader.read).mock.calls[1]?.[2]).toEqual({
      limit: 200,
      conversation: 'c1',
      after: 1,
    });
    expect(sessions.appendEventsIf).toHaveBeenCalled();
  });

  it('counts a slash command with arguments as a prompt, as the runner does', async () => {
    const sessions = repository();
    const commands = transcript(
      line(
        'user',
        '<command-name>/review</command-name>\n<command-args>the auth module</command-args>',
      ),
      line('assistant', 'Reviewed.'),
      line('user', 'now fix what you found'),
    );
    const client = llm(answer('Auth module review fixes'));
    await new SessionNamingResolver(sessions, commands, client, config()).nameFromBatch(
      session('prompt'),
      answered,
    );
    expect(vi.mocked(client.complete).mock.calls[0][0].messages[0].content).toContain(
      '1. /review the auth module',
    );
    expect(sessions.appendEventsIf).toHaveBeenCalled();
  });

  it('counts nothing when the conversation started over between two reads', async () => {
    const reader: SessionTranscriptPort = {
      read: vi
        .fn()
        .mockResolvedValueOnce({
          kind: 'page',
          page: {
            entries: [line('user', 'fix the bug')],
            from: 0,
            next: 1,
            atEnd: false,
            conversation: 'c1',
          },
        })
        .mockResolvedValueOnce({
          kind: 'page',
          page: {
            entries: [line('user', 'fix the bug')],
            from: 0,
            next: 1,
            atEnd: true,
            conversation: 'c2',
            restarted: true,
          },
        }),
    };
    const sessions = repository();
    await new SessionNamingResolver(sessions, reader, llm(answer('never')), config()).nameFromBatch(
      session('model'),
      answered,
    );
    expect(sessions.appendEventsIf).not.toHaveBeenCalled();
  });

  it('waits for a second prompt before renaming', async () => {
    const sessions = repository();
    const client = llm(answer('never'));
    const onePrompt = transcript(line('user', 'fix the bug'), line('assistant', 'Done.'));
    await new SessionNamingResolver(sessions, onePrompt, client, config()).nameFromBatch(
      session('model'),
      answered,
    );
    expect(client.complete).not.toHaveBeenCalled();
    expect(sessions.appendEventsIf).not.toHaveBeenCalled();
  });

  it.each(['user', 'conversation'] as const)(
    'never reads the conversation of a session named by %s',
    async (source) => {
      const reader = twoPrompts();
      const client = llm(answer('never'));
      await new SessionNamingResolver(repository(), reader, client, config()).nameFromBatch(
        session(source),
        answered,
      );
      expect(reader.read).not.toHaveBeenCalled();
      expect(client.complete).not.toHaveBeenCalled();
    },
  );

  it('leaves the name when no model is configured', async () => {
    const reader = twoPrompts();
    const sessions = repository();
    await new SessionNamingResolver(
      sessions,
      reader,
      llm(answer('never'), { configured: false }),
      config(),
    ).nameFromBatch(session('prompt'), answered);
    expect(reader.read).not.toHaveBeenCalled();
    expect(sessions.appendEventsIf).not.toHaveBeenCalled();
  });

  it('reads nothing while the agent is still working', async () => {
    const reader = twoPrompts();
    const working = [
      { kind: 'agent.observed', payload: { state: 'working' } },
    ] as unknown as WorkSessionEventEntity[];
    await new SessionNamingResolver(repository(), reader, llm(answer('x')), config()).nameFromBatch(
      session('model'),
      working,
    );
    expect(reader.read).not.toHaveBeenCalled();
  });
});
