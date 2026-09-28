import { Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import { InstallStateResolver } from '../../application/install-state.resolver';
import { GithubErrors } from '../../domain/github.errors';
import { GITHUB_APP } from '../../github.di-tokens';
import type { GithubAppPort } from '../../infrastructure/github-app.port';
import { StartInstallationCommand } from './start-installation.command';

export interface StartedInstallation {
  /** The App's installation page, carrying `state`. */
  url: string;
  state: string;
  expiresAt: Date;
}

/**
 * Starts a GitHub App install: mints the single-use state `POST /installations`
 * will require, and hands back the install URL that carries it.
 *
 * It returns more than an id because the state is about this request and no
 * query can read it back — the attach ticket's precedent.
 */
@CommandHandler(StartInstallationCommand)
export class StartInstallationCommandHandler
  implements ICommandHandler<StartInstallationCommand, StartedInstallation>
{
  constructor(
    @Inject(GITHUB_APP)
    private readonly github: GithubAppPort,
    private readonly installState: InstallStateResolver,
    private readonly configService: ConfigService,
  ) {}

  async execute(command: StartInstallationCommand): Promise<StartedInstallation> {
    const slug = this.appSlug;
    if (!this.github.isConfigured() || !slug) {
      throw new AppError(GithubErrors.APP_NOT_CONFIGURED);
    }

    const { state, expiresAt } = await this.installState.mint(
      command.userId,
      command.organizationId,
    );
    // The same page `GET /health/capabilities` offers as `github_app_install_url`
    // (`health.probe.controller.ts`), which keeps serving it bare: clients read
    // that one only to know an App exists. Change both together.
    const url = new URL(`https://github.com/apps/${encodeURIComponent(slug)}/installations/new`);
    url.searchParams.set('state', state);
    return { url: url.toString(), state, expiresAt };
  }

  private get appSlug(): string | undefined {
    return this.configService.get<string>('githubApp.slug') || undefined;
  }
}
