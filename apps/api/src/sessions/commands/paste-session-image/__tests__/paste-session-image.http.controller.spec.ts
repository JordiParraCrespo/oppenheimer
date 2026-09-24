import 'reflect-metadata';
import {
  type CallHandler,
  type ExecutionContext,
  type INestApplication,
  VersioningType,
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { Test } from '@nestjs/testing';
import { AllExceptionsFilter } from '@oppenheimer/backend-core';
import { SESSION_IMAGE_MAX_BYTES } from '@oppenheimer/shared';
import { ZodValidationPipe } from 'nestjs-zod';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiAuthGuard } from '../../../../auth/guards/api-auth.guard';
import { PoliciesGuard } from '../../../../auth/guards/policies.guard';
import { ACCESS_SCOPE_KEY } from '../../../../authz/decorators/current-access-scope.decorator';
import { AccessScopeInterceptor } from '../../../../authz/interceptors/access-scope.interceptor';
import { PasteSessionImageCommand } from '../paste-session-image.command';
import { PasteSessionImageHttpController } from '../paste-session-image.http.controller';

/**
 * The request pipeline an upload goes through — multer, its size limit and the
 * catalog it is folded onto, the form field beside the file — with auth and
 * the bus stubbed. What the handler decides is its own spec's.
 */

const SESSION = '3f0d9e2c-6a4b-4e9a-9c3d-7b1e5a2f8c40';
const SCOPE = {
  userId: 'user-1',
  organizationId: 'org-acme',
  teamIds: [],
  grants: new Map(),
  bypass: false,
};
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]);

describe('POST /v1/sessions/:id/images', () => {
  let app: INestApplication;
  let url: string;
  const execute = vi.fn();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [PasteSessionImageHttpController],
      providers: [{ provide: CommandBus, useValue: { execute } }],
    })
      .overrideGuard(ApiAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(PoliciesGuard)
      .useValue({ canActivate: () => true })
      .overrideInterceptor(AccessScopeInterceptor)
      .useValue({
        intercept: (context: ExecutionContext, next: CallHandler) => {
          context.switchToHttp().getRequest()[ACCESS_SCOPE_KEY] = SCOPE;
          return next.handle();
        },
      })
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.useGlobalPipes(new ZodValidationPipe());
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.listen(0);
    url = `${(await app.getUrl()).replace('[::1]', '127.0.0.1')}/api/v1/sessions/${SESSION}/images`;
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    execute.mockReset().mockResolvedValue({ delivered: true, hints: [] });
  });

  const post = (fields: Record<string, Blob | string>) => {
    const body = new FormData();
    for (const [name, value] of Object.entries(fields)) body.append(name, value);
    return fetch(url, { method: 'POST', body });
  };

  it('accepts an image with 202 and hands the bytes and the window to the bus', async () => {
    const response = await post({ file: new Blob([PNG], { type: 'image/png' }), window: '2' });

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toEqual({ delivered: true, hints: [] });
    const command = execute.mock.calls[0]?.[0] as PasteSessionImageCommand;
    expect(command).toBeInstanceOf(PasteSessionImageCommand);
    expect(command).toMatchObject({ sessionId: SESSION, window: 2, scope: SCOPE });
    expect(new Uint8Array(command.data)).toEqual(PNG);
  });

  it('takes the agent’s window when none is named', async () => {
    await post({ file: new Blob([PNG]) });
    expect(execute.mock.calls[0]?.[0]).toMatchObject({ window: 0 });
  });

  it('refuses an image over the ceiling with SESSIONS_011, before the bus sees it', async () => {
    const response = await post({ file: new Blob([new Uint8Array(SESSION_IMAGE_MAX_BYTES + 1)]) });

    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toMatchObject({
      code: 'SESSIONS_011',
      maxBytes: SESSION_IMAGE_MAX_BYTES,
    });
    expect(execute).not.toHaveBeenCalled();
  });

  it('refuses a request with no file with SESSIONS_012', async () => {
    const response = await post({ window: '0' });

    expect(response.status).toBe(415);
    await expect(response.json()).resolves.toMatchObject({ code: 'SESSIONS_012' });
    expect(execute).not.toHaveBeenCalled();
  });

  it('refuses a window that is not a window', async () => {
    const response = await post({ file: new Blob([PNG]), window: '-1' });

    expect(response.status).toBe(400);
    expect(execute).not.toHaveBeenCalled();
  });
});
