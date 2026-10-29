import { AppError } from '@oppenheimer/frontend-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BotsErrors } from '../bots.errors';

/**
 * The bots repository maps the API's rows into entities and hands a
 * refusal over with the server's code, which is what the instructions editor
 * branches on when a save lands over a newer revision.
 */

const sdk = vi.hoisted(() => ({
  findBots: vi.fn(),
  createBot: vi.fn(),
  updateBotDocument: vi.fn(),
  findBotDocumentRevisions: vi.fn(),
  findBotConversation: vi.fn(),
  exportBotConversation: vi.fn(),
  decideBotApproval: vi.fn(),
}));

vi.mock('@oppenheimer/api-client', () => ({ heyApiSdk: sdk }));

function ok(data: unknown) {
  return { data, error: undefined, response: new Response(null, { status: 200 }) };
}

function refused(status: number, body: unknown) {
  return { data: undefined, error: body, response: new Response(null, { status }) };
}

const { BotsRepository } = await import('../bots.repository');
const { documentConflictRevision } = await import('../bot.entity');

function botDto(overrides: Record<string, unknown> = {}) {
  return {
    id: 'bot-1',
    name: 'New Bot',
    description: '',
    avatarColor: 'tangerine',
    groupId: null,
    position: 0,
    homeHostId: null,
    model: null,
    effort: 'medium',
    permission: 'auto',
    learnAutomatically: false,
    createdAt: '2026-10-14T09:00:00.000Z',
    updatedAt: '2026-10-14T09:00:00.000Z',
    lastActivityAt: '2026-10-14T09:30:00.000Z',
    lastMessagePreview: 'Shipped the release notes.',
    ...overrides,
  };
}

describe('BotsRepository', () => {
  let repository: InstanceType<typeof BotsRepository>;

  beforeEach(() => {
    vi.clearAllMocks();
    repository = new BotsRepository();
  });

  it('maps a bot, parsing its dates and keeping an unchosen host as null', async () => {
    sdk.findBots.mockResolvedValue(ok([botDto()]));

    const [bot] = await repository.findAll();

    expect(bot?.name).toBe('New Bot');
    expect(bot?.avatarColor).toBe('tangerine');
    expect(bot?.homeHostId).toBeNull();
    expect(bot?.lastActivityAt).toEqual(new Date('2026-10-14T09:30:00.000Z'));
    expect(bot?.lastMessagePreview).toBe('Shipped the release notes.');
  });

  it('treats an absent body as a failed read, not an empty sidebar', async () => {
    sdk.findBots.mockResolvedValue(ok(undefined));

    const error = await repository.findAll().catch((thrown: unknown) => thrown);

    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).code).toBe(BotsErrors.FETCH_LIST_FAILED.code);
  });

  it('creates a blank bot by sending no fields, so the API names and colours it', async () => {
    sdk.createBot.mockResolvedValue(ok(botDto()));

    await repository.create();

    expect(sdk.createBot).toHaveBeenCalledWith({ body: {} });
  });

  it('sends the revision the editor loaded with a save', async () => {
    sdk.updateBotDocument.mockResolvedValue(
      ok({
        name: 'instructions',
        content: '# Job',
        revision: 3,
        updatedBy: 'user',
        updatedByUserId: 'u',
        updatedAt: '2026-10-14T10:00:00.000Z',
      }),
    );

    const saved = await repository.saveDocument('bot-1', 'instructions', {
      content: '# Job',
      baseRevision: 2,
    });

    expect(sdk.updateBotDocument).toHaveBeenCalledWith({
      path: { id: 'bot-1', name: 'instructions' },
      body: { content: '# Job', baseRevision: 2 },
    });
    expect(saved.revision).toBe(3);
  });

  it('hands a save over a newer revision back with the server’s code and revision', async () => {
    sdk.updateBotDocument.mockResolvedValue(
      refused(409, {
        type: 'https://oppenheimer.dev/errors#bots_006',
        title: 'The document was changed since it was loaded',
        status: 409,
        code: 'BOTS_006',
        detail: 'instructions is at revision 4, not 2',
        revision: 4,
      }),
    );

    const error = await repository
      .saveDocument('bot-1', 'instructions', { content: 'x', baseRevision: 2 })
      .catch((thrown: unknown) => thrown);

    expect((error as AppError).code).toBe('BOTS_006');
    expect(documentConflictRevision(error)).toBe(4);
  });

  it('maps revisions newest first as the API sends them, keeping a revert’s source', async () => {
    sdk.findBotDocumentRevisions.mockResolvedValue(
      ok([
        {
          id: 'r3',
          name: 'instructions',
          revision: 3,
          content: '',
          author: 'user',
          authorUserId: 'u',
          note: '',
          revertedFrom: 1,
          createdAt: '2026-10-14T11:00:00.000Z',
        },
      ]),
    );

    const [revision] = await repository.findRevisions('bot-1', 'instructions');

    expect(revision?.revertedFrom).toBe(1);
    expect(revision?.createdAt).toEqual(new Date('2026-10-14T11:00:00.000Z'));
  });

  it('maps a conversation, and finds the turn Stop applies to', async () => {
    const turn = (id: string, status: string, startedAt: string | null) => ({
      id,
      status,
      provider: 'glm',
      model: 'glm-5.3',
      error: null,
      inputTokens: 0,
      outputTokens: 0,
      contextTokens: null,
      contextWindow: null,
      planLimits: null,
      cancelRequested: false,
      createdAt: '2026-10-15T09:00:00.000Z',
      startedAt,
      endedAt: null,
    });
    sdk.findBotConversation.mockResolvedValue(
      ok({
        messages: [
          {
            id: 'm1',
            turnId: 't1',
            role: 'activity',
            content: '',
            steps: [
              {
                callId: 'c1',
                name: 'read',
                input: {},
                output: null,
                isError: false,
                sessionId: null,
                subagents: null,
                mailDraft: null,
              },
            ],
            createdAt: '2026-10-15T09:00:01.000Z',
          },
        ],
        turns: [turn('t1', 'queued', null), turn('t2', 'running', '2026-10-15T09:00:02.000Z')],
      }),
    );
    const conversation = await repository.findConversation('bot-1');
    expect(conversation.messages[0]?.steps[0]?.output).toBeNull();
    expect(conversation.messages[0]?.createdAt).toEqual(new Date('2026-10-15T09:00:01.000Z'));
    expect(conversation.turns[0]?.startedAt).toBeNull();
    expect(conversation.activeTurn?.id).toBe('t2');
  });

  it('reads the room left off the newest turns that said, and your messages waiting behind the running turn', async () => {
    const turn = (id: string, status: string, extra: Record<string, unknown> = {}) => ({
      id,
      status,
      provider: 'chatgpt',
      model: 'model-placeholder',
      error: null,
      inputTokens: 0,
      outputTokens: 0,
      contextTokens: null,
      contextWindow: null,
      planLimits: null,
      cancelRequested: false,
      createdAt: '2026-10-15T09:00:00.000Z',
      startedAt: null,
      endedAt: null,
      ...extra,
    });
    const asked = (id: string, turnId: string, content: string) => ({
      id,
      turnId,
      role: 'user',
      content,
      steps: [],
      createdAt: '2026-10-15T09:00:00.000Z',
    });
    sdk.findBotConversation.mockResolvedValue(
      ok({
        messages: [asked('m3', 't3', 'Look first'), asked('m4', 't4', 'Then ship it')],
        turns: [
          turn('t1', 'completed', {
            contextTokens: 9_000,
            planLimits: {
              fiveHour: { usedPercent: 12, resetsAt: '2026-10-15T12:00:00.000Z' },
              sevenDay: null,
            },
          }),
          // A newer turn on a key: its context is the latest, the plan stays t1's.
          turn('t2', 'completed', { contextTokens: 41_000, contextWindow: 200_000 }),
          turn('t3', 'running'),
          turn('t4', 'queued'),
          turn('t5', 'queued'),
        ],
      }),
    );
    const conversation = await repository.findConversation('bot-1');
    expect(conversation.roomLeft).toEqual({
      context: { tokens: 41_000, window: 200_000 },
      planLimits: {
        fiveHour: { usedPercent: 12, resetsAt: new Date('2026-10-15T12:00:00.000Z') },
        sevenDay: null,
      },
    });
    // t5 was opened by no message of yours (a routine): it stays in the transcript.
    expect(conversation.waitingMessages).toEqual([
      { turnId: 't4', text: 'Then ship it', images: 0 },
    ]);
  });

  it('keeps the session an approved call started on its event, for the chat to open', async () => {
    sdk.findBotConversation.mockResolvedValue(
      ok({
        messages: [
          {
            id: 'm1',
            turnId: 't1',
            role: 'event',
            content: 'Ana approved: Start it',
            steps: [],
            event: {
              kind: 'approval',
              outcome: 'approved',
              tool: 'start_session',
              summary: 'Start it',
              fromBotId: null,
              fromBotName: null,
              expectsReply: null,
              sessionId: 's-1',
            },
            createdAt: '2026-10-15T09:00:01.000Z',
          },
        ],
        turns: [],
      }),
    );
    const conversation = await repository.findConversation('bot-1');
    expect(conversation.messages[0]?.event).toMatchObject({ kind: 'approval', sessionId: 's-1' });
  });

  it('reads an ask_user card as questions to answer, and sends the answers with the decision', async () => {
    sdk.decideBotApproval.mockResolvedValue(
      ok({
        id: 'a-1',
        turnId: 't1',
        tool: 'ask_user',
        input: {
          questions: [
            {
              header: 'Repo',
              question: 'Which repository?',
              multiSelect: false,
              options: [{ label: 'acme/web' }, { label: 'acme/api', description: 'The API' }],
            },
          ],
        },
        summary: 'Which repository?',
        status: 'answered',
        result: null,
        note: null,
        answers: [{ picks: [1], other: null }],
        subjectKind: null,
        subjectLabel: null,
        sharesOutside: false,
        reviewNote: null,
        reaches: [],
        reach: null,
        decidedByUserId: 'u-1',
        decidedAt: '2026-10-15T09:00:01.000Z',
        createdAt: '2026-10-15T09:00:00.000Z',
      }),
    );
    const card = await repository.decideApproval('bot-1', 'a-1', 'answer', undefined, 'once', [
      { picks: [1], other: null },
    ]);
    expect(sdk.decideBotApproval).toHaveBeenCalledWith({
      path: { id: 'bot-1', approvalId: 'a-1' },
      body: { decision: 'answer', reach: 'once', answers: [{ picks: [1], other: null }] },
    });
    expect(card.isQuestion).toBe(true);
    expect(card.questions).toEqual([
      {
        header: 'Repo',
        question: 'Which repository?',
        multiSelect: false,
        options: [
          { label: 'acme/web', description: null },
          { label: 'acme/api', description: 'The API' },
        ],
      },
    ]);
    expect(card.answers).toEqual([{ picks: [1], other: null }]);
  });

  describe('exportConversation', () => {
    function lines(...messages: Record<string, unknown>[]) {
      const text = messages.map((message) => `${JSON.stringify(message)}\n`).join('');
      return new Response(text).body as ReadableStream<Uint8Array>;
    }
    const said = (id: string, content: string) => ({
      id,
      turnId: 't1',
      role: 'user',
      content,
      steps: [],
      event: null,
      createdAt: '2026-10-15T10:00:00.000Z',
    });

    it('asks for the body as a stream and hands each line on as a message', async () => {
      sdk.exportBotConversation.mockResolvedValue(ok(lines(said('m1', 'One'), said('m2', 'Two'))));
      const read: string[] = [];
      for await (const message of await repository.exportConversation('bot-1')) {
        read.push(message.content);
        expect(message.createdAt).toBeInstanceOf(Date);
      }
      expect(read).toEqual(['One', 'Two']);
      expect(sdk.exportBotConversation).toHaveBeenCalledWith({
        path: { id: 'bot-1' },
        parseAs: 'stream',
      });
    });

    it('fails the export with its own code when a line cannot be read', async () => {
      sdk.exportBotConversation.mockResolvedValue(
        ok(new Response('{"id":"m1"\nnot json\n').body as ReadableStream<Uint8Array>),
      );
      const reading = (async () => {
        for await (const _ of await repository.exportConversation('bot-1')) {
          // drained
        }
      })();
      await expect(reading).rejects.toMatchObject({
        code: BotsErrors.EXPORT_CONVERSATION_FAILED.code,
      });
    });
  });
});
