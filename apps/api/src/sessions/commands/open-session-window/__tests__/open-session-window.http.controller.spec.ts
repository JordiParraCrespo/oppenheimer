import 'reflect-metadata';
import {
  type CallHandler,
  type ExecutionContext,
  type INestApplication,
  VersioningType,
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { Test } from '@nestjs/testing';
import { AllExceptionsFilter, SanitizePipe } from '@oppenheimer/backend-core';
import { FIELD_BOUNDS } from '@oppenheimer/shared';
import { ZodValidationPipe } from 'nestjs-zod';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiAuthGuard } from '../../../../auth/guards/api-auth.guard';
import { PoliciesGuard } from '../../../../auth/guards/policies.guard';
import { ACCESS_SCOPE_KEY } from '../../../../authz/decorators/current-access-scope.decorator';
import { AccessScopeInterceptor } from '../../../../authz/interceptors/access-scope.interceptor';
import { OpenSessionWindowCommand } from '../open-session-window.command';
import { OpenSessionWindowHttpController } from '../open-session-window.http.controller';

/**
 * The open's body on its way to the bus, with auth and the bus stubbed: no
 * body at all is still a plain shell (every caller from before the body
 * existed sends none), an agent is handed on, and an agent a window cannot
 * start is refused before the host is asked. What the handler decides is
 * `session-windows.spec.ts`'s.
 */

const SESSION = '3f0d9e2c-6a4b-4e9a-9c3d-7b1e5a2f8c40';
const SCOPE = {
  userId: 'user-1',
  organizationId: 'org-acme',
  teamIds: [],
  grants: new Map(),
  bypass: false,
};

describe('POST /v1/sessions/:id/windows', () => {
  let app: INestApplication;
  let url: string;
  const execute = vi.fn();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [OpenSessionWindowHttpController],
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
    app.useGlobalPipes(new SanitizePipe(), new ZodValidationPipe());
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.listen(0);
    url = `${(await app.getUrl()).replace('[::1]', '127.0.0.1')}/api/v1/sessions/${SESSION}/windows`;
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    execute.mockReset().mockResolvedValue({ window: { index: 1 }, windows: [] });
  });

  const post = (body?: unknown) =>
    fetch(url, {
      method: 'POST',
      ...(body === undefined
        ? {}
        : { body: JSON.stringify(body), headers: { 'content-type': 'application/json' } }),
    });
  const sent = () => execute.mock.calls[0]?.[0] as OpenSessionWindowCommand;

  it('opens a plain shell for a request with no body', async () => {
    const response = await post();

    expect(response.status).toBe(201);
    expect(sent()).toBeInstanceOf(OpenSessionWindowCommand);
    expect(sent()).toMatchObject({ sessionId: SESSION, scope: SCOPE, window: {} });
    expect(sent().window.agent).toBeUndefined();
  });

  it('hands the agent a body names, how it starts and its first task, to the bus', async () => {
    const response = await post({
      agent: 'codex',
      model: 'gpt-6.1-terra',
      effort: 'high',
      permission: 'full',
      prompt: '  Fix the picker  ',
    });

    expect(response.status).toBe(201);
    expect(sent()).toMatchObject({
      sessionId: SESSION,
      window: {
        agent: 'codex',
        model: 'gpt-6.1-terra',
        effort: 'high',
        permission: 'full',
        // Trimmed, as a new session's first task is.
        prompt: 'Fix the picker',
      },
    });
  });

  it('refuses a launch or a first task outside a new session’s bounds, before the bus sees it', async () => {
    for (const body of [
      { agent: 'codex', permission: 'yolo' },
      { agent: 'codex', effort: 'extreme' },
      { agent: 'codex', model: '' },
      { agent: 'codex', prompt: '   ' },
      { agent: 'codex', prompt: 'x'.repeat(FIELD_BOUNDS.prompt.maxBytes + 1) },
    ]) {
      const response = await post(body);
      expect(response.status).toBe(400);
    }
    expect(execute).not.toHaveBeenCalled();
  });

  it('refuses the blank terminal and an agent outside the catalog, before the bus sees them', async () => {
    for (const agent of ['shell', 'cursor']) {
      const response = await post({ agent });
      expect(response.status).toBe(400);
    }
    expect(execute).not.toHaveBeenCalled();
  });
});
