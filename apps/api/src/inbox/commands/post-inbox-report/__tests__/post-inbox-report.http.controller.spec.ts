import 'reflect-metadata';
import { type ExecutionContext, type INestApplication, VersioningType } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { Test } from '@nestjs/testing';
import { AllExceptionsFilter, SanitizePipe } from '@oppenheimer/backend-core';
import { INBOX_REPORT_IMAGE_MAX_BYTES } from '@oppenheimer/shared';
import { ZodValidationPipe } from 'nestjs-zod';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiAuthGuard } from '../../../../auth/guards/api-auth.guard';
import { FeatureFlagGuard } from '../../../../feature-flags/guards/feature-flag.guard';
import { InboxReportEntity } from '../../../domain/inbox-report.entity';
import { InboxReportMapper } from '../../../inbox-report.mapper';
import { PostInboxReportCommand } from '../post-inbox-report.command';
import { PostInboxReportHttpController } from '../post-inbox-report.http.controller';

/**
 * The request pipeline a report goes through: multer with its two limits
 * folded onto the Inbox's catalog, and the form's text fields beside the
 * pictures, with auth and the buses stubbed. What the handler decides is its
 * own spec's.
 */
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]);

describe('POST /v1/inbox/reports', () => {
  let app: INestApplication;
  let url: string;
  const execute = vi.fn();
  const stored = InboxReportEntity.post({
    organizationId: 'org-acme',
    createdByUserId: 'user-1',
    title: 'Checkout is down',
    body: '',
    source: '',
    link: null,
    images: [{ mimeType: 'image/png', sizeBytes: 12, name: 'shot.png', extension: 'png' }],
  });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [PostInboxReportHttpController],
      providers: [
        InboxReportMapper,
        { provide: CommandBus, useValue: { execute } },
        { provide: QueryBus, useValue: { execute: async () => stored } },
      ],
    })
      .overrideGuard(ApiAuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          Object.assign(context.switchToHttp().getRequest(), {
            user: { id: 'user-1' },
            tenant: { organizationId: 'org-acme' },
          });
          return true;
        },
      })
      .overrideGuard(FeatureFlagGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.useGlobalPipes(new SanitizePipe(), new ZodValidationPipe());
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.listen(0);
    url = `${(await app.getUrl()).replace('[::1]', '127.0.0.1')}/api/v1/inbox/reports`;
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    execute.mockReset().mockResolvedValue(stored.id);
  });

  const post = (fields: [name: string, value: Blob | string][]) => {
    const body = new FormData();
    for (const [name, value] of fields) body.append(name, value);
    return fetch(url, { method: 'POST', body });
  };
  const png = (): [string, Blob] => ['images', new Blob([PNG], { type: 'image/png' })];

  it('hands the text, the workspace and every picture’s bytes to the bus, and answers the report without its storage keys', async () => {
    const response = await post([
      ['title', ' Checkout is down '],
      ['source', 'qa-explorer'],
      ['link', ''],
      png(),
      png(),
    ]);

    expect(response.status).toBe(201);
    const command = execute.mock.calls[0]?.[0] as PostInboxReportCommand;
    expect(command).toBeInstanceOf(PostInboxReportCommand);
    expect(command).toMatchObject({
      organizationId: 'org-acme',
      userId: 'user-1',
      title: 'Checkout is down',
      body: '',
      source: 'qa-explorer',
      link: null,
    });
    expect(command.images.map((image) => new Uint8Array(image.data))).toEqual([PNG, PNG]);

    const answered = await response.json();
    expect(answered).toMatchObject({ id: stored.id, status: 'open', answer: null });
    expect(answered.images).toEqual([
      { id: stored.images[0].id, mimeType: 'image/png', sizeBytes: 12, name: 'shot.png' },
    ]);
  });

  it('takes a report with no picture', async () => {
    const response = await post([['title', 'Checkout is down']]);
    expect(response.status).toBe(201);
    expect(execute.mock.calls[0]?.[0]).toMatchObject({ images: [] });
  });

  it('refuses a fifth picture with INBOX_007, before the bus sees it', async () => {
    const response = await post([['title', 'T'], png(), png(), png(), png(), png()]);

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toMatchObject({ code: 'INBOX_007', maxImages: 4 });
    expect(execute).not.toHaveBeenCalled();
  });

  it('refuses a picture over the ceiling with INBOX_008, before the bus sees it', async () => {
    const large = new Blob([new Uint8Array(INBOX_REPORT_IMAGE_MAX_BYTES + 1)]);
    const response = await post([
      ['title', 'T'],
      ['images', large],
    ]);

    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toMatchObject({
      code: 'INBOX_008',
      maxBytes: INBOX_REPORT_IMAGE_MAX_BYTES,
    });
    expect(execute).not.toHaveBeenCalled();
  });

  it('refuses a report with no title, or a link that is no URL, with 400', async () => {
    expect((await post([['body', 'no title'], png()])).status).toBe(400);
    expect(
      (
        await post([
          ['title', 'T'],
          ['link', 'not a url'],
        ])
      ).status,
    ).toBe(400);
    expect(execute).not.toHaveBeenCalled();
  });
});
