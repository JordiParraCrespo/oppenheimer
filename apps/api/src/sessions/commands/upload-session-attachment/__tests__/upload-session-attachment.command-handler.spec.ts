import { describe, expect, it, vi } from 'vitest';
import type { ParkedImagePort } from '../../../../links/application/parked-image.port';
import { UploadSessionAttachmentCommand } from '../upload-session-attachment.command';
import { UploadSessionAttachmentCommandHandler } from '../upload-session-attachment.command-handler';

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);

function harness() {
  const store = {
    park: vi.fn(),
    stage: vi.fn().mockResolvedValue('staged-1'),
    claim: vi.fn(),
    collect: vi.fn(),
  } satisfies ParkedImagePort;
  return { store, handler: new UploadSessionAttachmentCommandHandler(store) };
}

const upload = (data: Buffer | undefined, organizationId: string | null = 'org-acme') =>
  new UploadSessionAttachmentCommand({ organizationId, userId: 'user-1', data });

describe('UploadSessionAttachmentCommandHandler', () => {
  it('keeps an image for its uploader and says what it is by its bytes', async () => {
    const { store, handler } = harness();

    const result = await handler.execute(upload(PNG));

    expect(result).toEqual({ id: 'staged-1', mediaType: 'image/png', size: PNG.length });
    expect(store.stage).toHaveBeenCalledWith({
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
    expect(store.stage).not.toHaveBeenCalled();
  });

  it('refuses a caller with no active workspace', async () => {
    const { handler } = harness();

    await expect(handler.execute(upload(PNG, null))).rejects.toMatchObject({
      code: 'SESSIONS_002',
    });
  });

  it('refuses an upload past the per-person cap', async () => {
    const { store, handler } = harness();
    store.stage.mockResolvedValue(undefined);

    await expect(handler.execute(upload(PNG))).rejects.toMatchObject({ code: 'SESSIONS_020' });
  });

  it('answers a request with no file part as no image attached', async () => {
    const { handler } = harness();

    await expect(handler.execute(upload(undefined))).rejects.toMatchObject({
      code: 'SESSIONS_015',
    });
  });
});
