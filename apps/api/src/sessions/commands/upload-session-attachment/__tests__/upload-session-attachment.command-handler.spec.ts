import { describe, expect, it, vi } from 'vitest';
import type { SessionAttachmentStorePort } from '../../../infrastructure/session-attachment-store.port';
import { UploadSessionAttachmentCommand } from '../upload-session-attachment.command';
import { UploadSessionAttachmentCommandHandler } from '../upload-session-attachment.command-handler';

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);

function harness() {
  const store = {
    put: vi.fn().mockResolvedValue(undefined),
    find: vi.fn(),
    remove: vi.fn(),
  } satisfies SessionAttachmentStorePort;
  return { store, handler: new UploadSessionAttachmentCommandHandler(store) };
}

const upload = (data: Buffer, organizationId: string | null = 'org-acme') =>
  new UploadSessionAttachmentCommand({ organizationId, userId: 'user-1', data });

describe('UploadSessionAttachmentCommandHandler', () => {
  it('keeps an image for its uploader and says what it is by its bytes', async () => {
    const { store, handler } = harness();

    const result = await handler.execute(upload(PNG));

    expect(result).toEqual({ id: expect.any(String), mediaType: 'image/png', size: PNG.length });
    expect(store.put).toHaveBeenCalledWith({
      id: result.id,
      organizationId: 'org-acme',
      userId: 'user-1',
      mediaType: 'image/png',
      data: PNG,
    });
  });

  it('refuses bytes that are not an image a session takes, and keeps nothing', async () => {
    const { store, handler } = harness();

    await expect(handler.execute(upload(Buffer.from('<svg/>')))).rejects.toMatchObject({
      code: 'SESSIONS_013',
    });
    expect(store.put).not.toHaveBeenCalled();
  });

  it('refuses a caller with no active workspace', async () => {
    const { handler } = harness();

    await expect(handler.execute(upload(PNG, null))).rejects.toMatchObject({
      code: 'SESSIONS_002',
    });
  });
});
