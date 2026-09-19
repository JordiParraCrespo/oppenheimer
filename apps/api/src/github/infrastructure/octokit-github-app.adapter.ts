import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppError } from '@oppenheimer/backend-core';
import type { ErrorDefinition } from '@oppenheimer/backend-ddd';
import { App, Octokit } from 'octokit';
import { GithubErrors } from '../domain/github.errors';
import type {
  GithubAppPort,
  GithubBranch,
  GithubInstallationClaim,
  GithubRepository,
  GithubRepositoryToken,
} from './github-app.port';

/**
 * The fields this adapter reads off GitHub's JSON, declared here because
 * Octokit's generated route types do not resolve under the API's CommonJS
 * `moduleResolution: node` — its responses arrive untyped. Naming the fields is
 * what keeps that from spreading: everything below is narrowed once, at the
 * call, and nothing untyped leaves this file.
 */
interface RawUserInstallation {
  id: number;
  account: unknown;
  repository_selection: string;
}

interface RawRepository {
  id: number;
  name: string;
  full_name: string;
  default_branch: string;
  private: boolean;
  archived: boolean;
  pushed_at: string | null;
}

interface RawBranch {
  name: string;
  commit: { sha: string };
  protected?: boolean;
}

interface RawAccessToken {
  token: string;
  expires_at: string;
}

/**
 * The only file in the repository that imports Octokit.
 *
 * Everything it returns is in this module's own vocabulary, so a change of
 * client — or of transport — is a change to this file and nothing else. Its
 * other job is to make GitHub's failures into this module's problem documents:
 * an unwrapped `RequestError` would reach a client as a bare 500 with no code.
 */
@Injectable()
export class OctokitGithubAppAdapter implements GithubAppPort {
  private readonly logger = new Logger(OctokitGithubAppAdapter.name);
  /** Built on first use and kept: it holds the App JWT and refreshes it itself. */
  private client?: App;

  constructor(private readonly configService: ConfigService) {}

  isConfigured(): boolean {
    return Boolean(
      this.appId && this.privateKey && this.clientId && this.clientSecret && this.webhookSecret,
    );
  }

  async listUserInstallations(code: string): Promise<GithubInstallationClaim[]> {
    const app = this.app();

    // The code is exchanged once, here, and never stored. What it buys is the
    // one thing a forged installation id cannot fake: GitHub's own answer to
    // "which installations can this account see".
    const token = await this.exchangeCode(app, code);
    const octokit = new Octokit({ auth: token });

    const installations: RawUserInstallation[] = await this.callGithub(
      () => octokit.paginate<RawUserInstallation>('GET /user/installations'),
      GithubErrors.UPSTREAM_FAILED,
    );

    return installations.map((installation) => ({
      githubInstallationId: installation.id,
      accountLogin: accountLoginOf(installation.account),
      accountType: accountTypeOf(installation.account),
      repositorySelection: installation.repository_selection === 'all' ? 'all' : 'selected',
    }));
  }

  async listInstallationRepositories(githubInstallationId: number): Promise<GithubRepository[]> {
    const octokit = await this.installationClient(githubInstallationId);

    const repositories: RawRepository[] = await this.callGithub(
      () => octokit.paginate<RawRepository>('GET /installation/repositories'),
      GithubErrors.UPSTREAM_FAILED,
    );

    return repositories.map((repository) => ({
      githubRepoId: repository.id,
      name: repository.name,
      fullName: repository.full_name,
      defaultBranch: repository.default_branch,
      private: repository.private,
      archived: repository.archived,
      pushedAt: repository.pushed_at ?? null,
    }));
  }

  async listRepositoryBranches(
    githubInstallationId: number,
    githubRepoId: number,
  ): Promise<{ branches: GithubBranch[]; defaultBranch: string }> {
    // The repository is resolved through the installation's own listing rather
    // than by id alone, so a repository the installation does not cover is
    // refused here instead of reaching GitHub as someone else's repository.
    const repositories = await this.listInstallationRepositories(githubInstallationId);
    const repository = repositories.find((candidate) => candidate.githubRepoId === githubRepoId);
    if (!repository) {
      throw new AppError(GithubErrors.REPOSITORY_NOT_IN_INSTALLATION, {
        detail: `Installation ${githubInstallationId} does not cover repository ${githubRepoId}`,
        extensions: { githubRepoId },
      });
    }

    const [owner, name] = repository.fullName.split('/');
    const octokit = await this.installationClient(githubInstallationId);
    const branches: RawBranch[] = await this.callGithub(
      () =>
        octokit.paginate<RawBranch>('GET /repos/{owner}/{repo}/branches', {
          owner,
          repo: name,
        }),
      GithubErrors.UPSTREAM_FAILED,
    );

    return {
      defaultBranch: repository.defaultBranch,
      branches: branches.map((branch) => ({
        name: branch.name,
        commitSha: branch.commit.sha,
        protected: Boolean(branch.protected),
      })),
    };
  }

  async mintRepositoryToken(
    githubInstallationId: number,
    githubRepoId: number,
  ): Promise<GithubRepositoryToken> {
    const app = this.app();

    // Narrowed to one repository with contents and metadata only, and live every
    // time — so it fails the moment that repository leaves the installation,
    // which is what replaces an allowlist of our own
    // (`product/09-github-app-install.md` §4).
    const minted: RawAccessToken = await this.callGithub(async () => {
      const response = await app.octokit.request(
        'POST /app/installations/{installation_id}/access_tokens',
        {
          installation_id: githubInstallationId,
          repository_ids: [githubRepoId],
          permissions: { contents: 'write', metadata: 'read' },
        },
      );
      return response.data as RawAccessToken;
    }, GithubErrors.REPOSITORY_NOT_IN_INSTALLATION);

    return { token: minted.token, expiresAt: new Date(minted.expires_at) };
  }

  /** The App client, or the "not configured" problem document. */
  private app(): App {
    if (!this.isConfigured()) {
      throw new AppError(GithubErrors.APP_NOT_CONFIGURED, {
        detail:
          'Set GITHUB_APP_ID, GITHUB_APP_PRIVATE_KEY, GITHUB_APP_WEBHOOK_SECRET, GITHUB_APP_CLIENT_ID and GITHUB_APP_CLIENT_SECRET.',
      });
    }
    this.client ??= new App({
      appId: this.appId as string,
      privateKey: this.privateKey as string,
      oauth: { clientId: this.clientId as string, clientSecret: this.clientSecret as string },
      webhooks: { secret: this.webhookSecret as string },
    });
    return this.client;
  }

  private async installationClient(githubInstallationId: number): Promise<Octokit> {
    const app = this.app();
    const client: Octokit = await this.callGithub(
      () => app.getInstallationOctokit(githubInstallationId),
      GithubErrors.INSTALLATION_SUSPENDED,
    );
    return client;
  }

  private async exchangeCode(app: App, code: string): Promise<string> {
    const exchanged: { authentication: { token: string } } = await this.callGithub(
      () => app.oauth.createToken({ code }),
      GithubErrors.AUTHORIZATION_CODE_REJECTED,
    );
    return exchanged.authentication.token;
  }

  /**
   * Run one GitHub call and fold its failure onto the catalog.
   *
   * `on4xx` is the entry that describes what a client refusal *means* at this
   * call site — an expired code, a repository the installation does not cover —
   * while anything else is upstream trouble and a 502. GitHub's own status is
   * kept as an extension member so debugging loses nothing.
   */
  private async callGithub<T>(call: () => Promise<T>, on4xx: ErrorDefinition): Promise<T> {
    try {
      return await call();
    } catch (error) {
      const status = statusOf(error);
      this.logger.warn(
        { message: 'GitHub rejected a request', status: status ?? 'unknown' },
        error instanceof Error ? error.stack : String(error),
      );
      const definition =
        status && status >= 400 && status < 500 ? on4xx : GithubErrors.UPSTREAM_FAILED;
      throw new AppError(definition, {
        detail: 'GitHub answered this request with an error.',
        extensions: { upstreamStatus: status ?? null },
      });
    }
  }

  private get appId(): string | undefined {
    return this.configService.get<string>('githubApp.appId');
  }

  /**
   * The PEM key, with escaped newlines restored.
   *
   * A private key in a single-line `.env` or a container secret almost always
   * arrives with literal `\n`, and Octokit's signer rejects it with an opaque
   * parse error rather than saying so.
   */
  private get privateKey(): string | undefined {
    return this.configService.get<string>('githubApp.privateKey')?.replace(/\\n/g, '\n');
  }

  private get webhookSecret(): string | undefined {
    return this.configService.get<string>('githubApp.webhookSecret');
  }

  private get clientId(): string | undefined {
    return this.configService.get<string>('githubApp.clientId');
  }

  private get clientSecret(): string | undefined {
    return this.configService.get<string>('githubApp.clientSecret');
  }
}

/** GitHub's `account` is a user or an organization; both carry a `login`. */
function accountLoginOf(account: unknown): string {
  const record = account as { login?: unknown; slug?: unknown } | null;
  if (typeof record?.login === 'string') return record.login;
  // An enterprise installation has a slug instead of a login.
  if (typeof record?.slug === 'string') return record.slug;
  return 'unknown';
}

function accountTypeOf(account: unknown): string {
  const record = account as { type?: unknown } | null;
  return typeof record?.type === 'string' ? record.type : 'Organization';
}

function statusOf(error: unknown): number | undefined {
  const status = (error as { status?: unknown } | null)?.status;
  return typeof status === 'number' ? status : undefined;
}
