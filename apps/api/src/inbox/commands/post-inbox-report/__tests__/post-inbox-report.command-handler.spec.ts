import type { InboxReportRepositoryPort } from '../../../database/inbox-report.repository.port';
import type { InboxReportEntity } from '../../../domain/inbox-report.entity';
import type { InboxReportFilesPort } from '../../../infrastructure/inbox-report-files.port';
import { PostInboxReportCommand } from '../post-inbox-report.command';
import { PostInboxReportCommandHandler } from '../post-inbox-report.command-handler';

/**
 * POST /inbox/reports: a picture is known by its bytes, never by the name or
 * type it was sent under, and stored under the workspace and the report. One
 * picture that is refused refuses the report, with nothing stored; files
 * already written go when the row cannot be.
 */
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]);
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16]);

function setup() {
  const reports = {
    insert: vi.fn(async (_report: InboxReportEntity) => undefined),
  } satisfies Partial<InboxReportRepositoryPort>;
  const files = {
    store: vi.fn(async (_key: string, _file: Buffer, _mimeType: string) => undefined),
    read: vi.fn(),
    remove: vi.fn(async (_key: string) => undefined),
  } satisfies InboxReportFilesPort;
  const handler = new PostInboxReportCommandHandler(
    reports as unknown as InboxReportRepositoryPort,
    files,
  );
  const post = (
    images: { data: Buffer; name: string }[],
    organizationId: string | null = 'org-1',
  ) =>
    handler.execute(
      new PostInboxReportCommand({
        organizationId,
        userId: 'user-1',
        title: 'Checkout is down',
        body: 'Since 09:00',
        source: 'qa-explorer',
        link: null,
        images,
      }),
    );
  return { reports, files, post };
}

describe('PostInboxReportCommandHandler', () => {
  it('stores each picture by the type its bytes declare, under the workspace and the report', async () => {
    const { reports, files, post } = setup();

    const id = await post([
      { data: JPEG, name: 'really-a-jpeg.png' },
      { data: PNG, name: 'shot.png' },
    ]);

    const [stored] = reports.insert.mock.calls[0];
    expect(stored).toMatchObject({ id, organizationId: 'org-1', createdByUserId: 'user-1' });
    const [jpeg, png] = stored.images;
    expect(jpeg).toMatchObject({
      mimeType: 'image/jpeg',
      sizeBytes: JPEG.length,
      storageKey: `inbox-reports/org-1/${id}/${jpeg.id}.jpg`,
    });
    expect(files.store.mock.calls).toEqual([
      [jpeg.storageKey, JPEG, 'image/jpeg'],
      [png.storageKey, PNG, 'image/png'],
    ]);
  });

  it('sends a report with no picture, storing no file', async () => {
    const { reports, files, post } = setup();
    await post([]);
    expect(reports.insert).toHaveBeenCalledTimes(1);
    expect(files.store).not.toHaveBeenCalled();
  });

  it('refuses a file that is not a PNG, JPEG, GIF or WebP with INBOX_009, storing nothing, not even the pictures before it', async () => {
    const { reports, files, post } = setup();
    await expect(
      post([
        { data: PNG, name: 'shot.png' },
        { data: Buffer.from('<svg onload="x()"/>'), name: 'x.png' },
      ]),
    ).rejects.toMatchObject({ code: 'INBOX_009' });
    await expect(post([{ data: Buffer.from('%PDF-1.7'), name: 'x.pdf' }])).rejects.toMatchObject({
      code: 'INBOX_009',
    });
    expect(files.store).not.toHaveBeenCalled();
    expect(reports.insert).not.toHaveBeenCalled();
  });

  it('refuses a picture past 5 MB with INBOX_008', async () => {
    const { files, post } = setup();
    const large = Buffer.concat([PNG, Buffer.alloc(5 * 1024 * 1024)]);
    await expect(post([{ data: large, name: 'big.png' }])).rejects.toMatchObject({
      code: 'INBOX_008',
    });
    expect(files.store).not.toHaveBeenCalled();
  });

  it('refuses a fifth picture with INBOX_007', async () => {
    const { files, post } = setup();
    const five = Array.from({ length: 5 }, (_, index) => ({ data: PNG, name: `${index}.png` }));
    await expect(post(five)).rejects.toMatchObject({ code: 'INBOX_007' });
    expect(files.store).not.toHaveBeenCalled();
  });

  it('refuses a credential that acts in no workspace with TENANT_001', async () => {
    const { reports, post } = setup();
    await expect(post([], null)).rejects.toMatchObject({ code: 'TENANT_001' });
    expect(reports.insert).not.toHaveBeenCalled();
  });

  it('deletes the files it stored when a later one, or the row, cannot be written', async () => {
    const { reports, files, post } = setup();
    reports.insert.mockRejectedValueOnce(new Error('connection reset'));
    await expect(
      post([
        { data: PNG, name: 'a.png' },
        { data: PNG, name: 'b.png' },
      ]),
    ).rejects.toThrow('connection reset');
    expect(files.remove.mock.calls.map(([key]) => key)).toEqual(
      files.store.mock.calls.map(([key]) => key),
    );

    files.store.mockClear();
    files.remove.mockClear();
    files.store.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('disk full'));
    await expect(
      post([
        { data: PNG, name: 'a.png' },
        { data: PNG, name: 'b.png' },
      ]),
    ).rejects.toThrow('disk full');
    expect(files.remove.mock.calls).toEqual([[files.store.mock.calls[0][0]]]);
  });
});
