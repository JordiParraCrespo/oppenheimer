import type { ConfigService } from '@nestjs/config';
import { describe, expect, it, vi } from 'vitest';
import type { InstallStateResolver } from '../../../application/install-state.resolver';
import type { GithubAppPort } from '../../../infrastructure/github-app.port';
import { StartInstallationCommand } from '../start-installation.command';
import { StartInstallationCommandHandler } from '../start-installation.command-handler';

const EXPIRES = new Date('2026-09-28T12:15:00.000Z');

function build({ configured = true, slug = 'oppenheimer-dev' as string | undefined } = {}) {
  const github = { isConfigured: vi.fn().mockReturnValue(configured) };
  const installState = {
    mint: vi.fn().mockResolvedValue({ state: 'minted-state_nonce-123', expiresAt: EXPIRES }),
  };
  const config = { get: vi.fn((key: string) => (key === 'githubApp.slug' ? slug : undefined)) };
  const handler = new StartInstallationCommandHandler(
    github as unknown as GithubAppPort,
    installState as unknown as InstallStateResolver,
    config as unknown as ConfigService,
  );
  return { handler, installState };
}

const command = () => new StartInstallationCommand({ organizationId: 'org-acme', userId: 'ana' });

describe('starting a GitHub App install', () => {
  it('mints a state for the caller and puts it on the App’s install URL', async () => {
    const { handler, installState } = build();

    const started = await handler.execute(command());

    expect(installState.mint).toHaveBeenCalledWith('ana', 'org-acme');
    const url = new URL(started.url);
    expect(`${url.origin}${url.pathname}`).toBe(
      'https://github.com/apps/oppenheimer-dev/installations/new',
    );
    expect(url.searchParams.get('state')).toBe('minted-state_nonce-123');
    expect(started).toMatchObject({ state: 'minted-state_nonce-123', expiresAt: EXPIRES });
  });

  it('says the App is not configured, and mints nothing', async () => {
    for (const subject of [build({ configured: false }), build({ slug: '' })]) {
      await expect(subject.handler.execute(command())).rejects.toMatchObject({
        code: 'GITHUB_002',
      });
      expect(subject.installState.mint).not.toHaveBeenCalled();
    }
  });
});
