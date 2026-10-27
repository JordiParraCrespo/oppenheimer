import type { ConfigService } from '@nestjs/config';
import type { CacheService } from '@oppenheimer/backend-cache';
import { AppError } from '@oppenheimer/backend-core';
import { Some } from 'oxide.ts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { HostAccessPort } from '../../../../hosts/application/host-access.port';
import { HostErrors } from '../../../../hosts/domain/hosts.errors';
import { AttachTicketFactory } from '../../../application/attach-ticket.factory';
import { SessionLoaderResolver } from '../../../application/session-loader.resolver';
import type { WorkSessionRepositoryPort } from '../../../database/work-session.repository.port';
import { previewAddressOf } from '../../../domain/session-preview.policy';
import { WorkSessionEntity } from '../../../domain/work-session.entity';
import { IssueSessionPreviewCommand } from '../issue-session-preview.command';
import { IssueSessionPreviewCommandHandler } from '../issue-session-preview.command-handler';

/**
 * A preview is a session's running app, so it is minted on the attach rule:
 * the session live, its host still the caller's to use. The ticket names the
 * port and travels to that port's own origin; a deployment with no preview
 * domain mints nothing.
 */

const SCOPE = {
  userId: 'user-1',
  organizationId: 'org-acme',
  teamIds: [],
  grants: new Map(),
  bypass: false,
};
const BASE = 'https://preview.example.test';

describe('IssueSessionPreviewCommandHandler', () => {
  let hosts: { assertUsable: ReturnType<typeof vi.fn> };
  let cache: { setIfAbsent: ReturnType<typeof vi.fn> };
  let settings: Record<string, string | undefined>;
  let handler: IssueSessionPreviewCommandHandler;
  let work: WorkSessionEntity;

  beforeEach(() => {
    work = WorkSessionEntity.request({
      organizationId: 'org-acme',
      projectId: 'project-1',
      createdByUserId: 'user-1',
      hostId: 'host-1',
      slug: 'bold-otter-3f9a7k',
      agent: 'claude-code',
    });
    const sessions = {
      findOneById: vi.fn().mockResolvedValue(Some(work)),
    } as unknown as WorkSessionRepositoryPort;
    hosts = { assertUsable: vi.fn().mockResolvedValue({ probedTools: null }) };
    cache = { setIfAbsent: vi.fn().mockResolvedValue(true) };
    settings = { 'relay.previewBaseUrl': BASE };
    handler = new IssueSessionPreviewCommandHandler(
      new SessionLoaderResolver(sessions),
      hosts as unknown as HostAccessPort,
      new AttachTicketFactory(cache as unknown as CacheService),
      { get: (key: string) => settings[key] } as unknown as ConfigService,
    );
  });

  const command = () =>
    new IssueSessionPreviewCommand({
      scope: SCOPE,
      sessionId: work.id,
      userId: 'user-1',
      port: 5173,
      path: '/docs',
      embed: true,
    });

  it("opens on the port's own origin with a ticket that names the port", async () => {
    const issued = await handler.execute(command());

    const url = new URL(issued.url);
    expect(previewAddressOf(BASE, url.host)).toEqual({ sessionId: work.id, port: 5173 });
    expect(url.searchParams.get('path')).toBe('/docs');
    const [, claim] = cache.setIfAbsent.mock.calls[0] as [string, Record<string, unknown>];
    expect(claim).toMatchObject({
      sessionId: work.id,
      userId: 'user-1',
      target: 'preview',
      port: 5173,
    });
  });

  it('refuses with SESSIONS_032, and mints nothing, with no preview domain', async () => {
    settings['relay.previewBaseUrl'] = undefined;

    await expect(handler.execute(command())).rejects.toMatchObject({ code: 'SESSIONS_032' });
    expect(cache.setIfAbsent).not.toHaveBeenCalled();
  });

  it('refuses with HOSTS_001, and mints nothing, once the host is out of reach', async () => {
    hosts.assertUsable.mockRejectedValue(new AppError(HostErrors.NOT_FOUND));

    await expect(handler.execute(command())).rejects.toMatchObject({ code: 'HOSTS_001' });
    expect(cache.setIfAbsent).not.toHaveBeenCalled();
  });
});
