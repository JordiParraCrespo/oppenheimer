import type { QueryBus } from '@nestjs/cqrs';
import { emptyScope } from '@oppenheimer/backend-authz';
import type { SessionSharedFile } from '@oppenheimer/shared';
import {
  FindSessionSharedPreviewQuery,
  type SessionSharedPreviewRead,
} from '../../../sessions/queries/find-session-shared-preview/find-session-shared-preview.query';
import type { BotAttachmentRepositoryPort } from '../../database/bot-attachment.repository.port';
import { SHOWN_IMAGES_DATA_KEY, SHOWN_IMAGES_PER_TURN } from '../../domain/bot-shown-image.policy';
import { NO_PERMISSIONS } from '../../domain/bot-tool-permission.policy';
import { BotTurnBudget } from '../../domain/bot-turn-budget.policy';
import type { BotAttachmentFilesPort } from '../../infrastructure/bot-attachment-files.port';
import { BotSessionFileToolsFactory } from '../bot-session-file-tools.factory';
import type { BotToolContext } from '../bot-tool.factory';

/**
 * `show_session_file` as the model sees it: an image an agent shared is shown
 * under the bot's reply as the bot's own JPEG attachment, from the preview the
 * sessions module read off the host; anything else (a text file, an id the
 * session never listed, a host that is away) is refused in words that say
 * what to do instead, and stores nothing. The host round trip is the relay
 * adapter's spec; which files are asked of the host is the query handler's.
 */
const SESSION = '3f0d9e2c-6a4b-4e9a-9c3d-7b1e5a2f8c40';
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]).toString('base64');
const signal = new AbortController().signal;

const context = (): BotToolContext => ({
  owner: emptyScope('owner-1', 'org-1'),
  organizationId: 'org-1',
  botId: 'bot-1',
  turnId: 'turn-1',
  homeHostId: null,
  timeZone: 'UTC',
  permission: 'auto',
  permissions: NO_PERMISSIONS,
  budget: new BotTurnBudget(),
  approvals: { request: vi.fn() },
});

const file = (overrides: Partial<SessionSharedFile> = {}): SessionSharedFile => ({
  id: '3f9a7c1e2b4d6a80',
  name: 'home-dark.png',
  mediaType: 'image/png',
  size: 812_000,
  caption: 'The home page, dark',
  hasPreview: true,
  at: '2026-11-03T10:00:00.000Z',
  ...overrides,
});

function setup(read: SessionSharedPreviewRead) {
  const queryBus = { execute: vi.fn(async () => read) };
  const attachments = { insert: vi.fn<BotAttachmentRepositoryPort['insert']>(async () => {}) };
  const files = {
    store: vi.fn<BotAttachmentFilesPort['store']>(async () => {}),
    remove: vi.fn<BotAttachmentFilesPort['remove']>(async () => {}),
  };
  const [tool] = new BotSessionFileToolsFactory(
    queryBus as unknown as QueryBus,
    attachments as unknown as BotAttachmentRepositoryPort,
    files as unknown as BotAttachmentFilesPort,
  ).definitions();
  if (!tool) throw new Error('no show_session_file');
  return { queryBus, attachments, files, tool };
}

describe('show_session_file', () => {
  // The regression: the bot cannot show the screenshot its agent took, or
  // shows it as something other than an image the chat can draw.
  it('stores the host’s preview as the bot’s own JPEG and hands it to the chat', async () => {
    const shared = file();
    const { tool, queryBus, attachments, files } = setup({
      kind: 'preview',
      file: shared,
      mediaType: 'image/jpeg',
      data: JPEG,
    });

    const result = await tool
      .bind(context())
      .run({ session_id: SESSION, file_id: shared.id }, { signal });

    const asked = queryBus.execute.mock.calls[0]?.[0] as unknown;
    expect(asked).toBeInstanceOf(FindSessionSharedPreviewQuery);
    expect(asked).toMatchObject({ sessionId: SESSION, fileId: shared.id });
    expect(result.isError).toBeFalsy();
    expect(result.content).toContain('Shown to the person under your reply as "home-dark.png"');
    const stored = attachments.insert.mock.calls.map(([attachment]) => attachment);
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({
      mimeType: 'image/jpeg',
      uploadedByUserId: null,
      name: 'home-dark.png',
      sizeBytes: 6,
    });
    expect(files.store).toHaveBeenCalledWith(
      stored[0]?.storageKey,
      Buffer.from(JPEG, 'base64'),
      'image/jpeg',
    );
    expect(JSON.parse(result.data?.[SHOWN_IMAGES_DATA_KEY] ?? '[]')).toHaveLength(1);
  });

  // The regression: a text file or an unknown id answered as if it were
  // shown, or as an error the bot cannot act on, with an orphan stored.
  it.each<[string, SessionSharedPreviewRead, string]>([
    [
      'a text file',
      {
        kind: 'no_preview',
        file: file({ name: 'notes.md', mediaType: 'text/markdown', hasPreview: false }),
      },
      'notes.md (text/markdown) is not an image',
    ],
    ['an id the session never listed', { kind: 'unknown_file' }, 'get_session lists the files'],
    ['a host that is away', { kind: 'host_offline', file: file() }, 'host is offline'],
    ['a file the host cleaned up', { kind: 'gone', file: file(), code: 'SESS_016' }, 'SESS_016'],
  ])('refuses %s in words and stores nothing', async (_name, read, said) => {
    const { tool, attachments, files } = setup(read);
    const result = await tool
      .bind(context())
      .run({ session_id: SESSION, file_id: 'x1' }, { signal });
    expect(result.content).toContain(said);
    expect(result.data).toBeUndefined();
    expect(attachments.insert).not.toHaveBeenCalled();
    expect(files.store).not.toHaveBeenCalled();
  });

  it(`shares the turn's ${SHOWN_IMAGES_PER_TURN} images with show_image`, async () => {
    const { tool, attachments } = setup({
      kind: 'preview',
      file: file(),
      mediaType: 'image/jpeg',
      data: JPEG,
    });
    const turn = context();
    for (let shown = 0; shown < SHOWN_IMAGES_PER_TURN; shown += 1) {
      turn.budget.take('show_image', SHOWN_IMAGES_PER_TURN);
    }
    const result = await tool.bind(turn).run({ session_id: SESSION, file_id: 'x1' }, { signal });
    expect(result.content).toContain('the limit');
    expect(attachments.insert).not.toHaveBeenCalled();
  });
});
