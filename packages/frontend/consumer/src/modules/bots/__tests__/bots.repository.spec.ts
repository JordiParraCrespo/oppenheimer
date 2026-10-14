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
});
