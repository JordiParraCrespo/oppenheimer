import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';

/**
 * A stand-in for GitHub, for the one part of the console that cannot be real
 * here.
 *
 * Repositories and branches are answered live by GitHub through a GitHub App
 * installation, and creating a session validates its repository the same way.
 * A deployment with no App therefore cannot exercise the create path at all —
 * which is why `tests/api/sessions.spec.ts` skips it, and why the web spec
 * beside it would have nothing to click.
 *
 * So this serves the six endpoints the REST adapter calls, and the API is
 * pointed at it with `GITHUB_APP_API_URL` / `GITHUB_APP_OAUTH_URL`
 * (`product/versions/mvp/03-control-plane.md`). **Everything else in the run
 * is the real thing**: a browser, the built console, the API with its guards,
 * its Zod pipe and its problem-document filter, and a real Postgres. The fake
 * stops at the network boundary the product does not own.
 *
 * The shapes are GitHub's own, copied from its REST reference rather than from
 * the adapter's readers — a stub written to suit the parser would pass while
 * the real API failed, which is the one thing a stub must not do.
 */
export interface StubRepository {
  id: number;
  name: string;
  full_name: string;
  default_branch: string;
  private: boolean;
  archived: boolean;
  pushed_at: string | null;
}

export interface GithubStubOptions {
  /** GitHub's own installation id, as the connect call will claim it. */
  installationId: number;
  /** 0 picks a free one. A run that starts the API first needs a fixed port. */
  port?: number;
  accountLogin: string;
  repositories: StubRepository[];
  /** Branch names per repository `full_name`. The first is the default. */
  branches: Record<string, string[]>;
}

export interface GithubStub {
  url: string;
  close: () => Promise<void>;
}

const DEFAULTS: GithubStubOptions = {
  installationId: 4242,
  accountLogin: 'acme-labs',
  repositories: [
    {
      id: 821374923,
      name: 'xrp-mobile',
      full_name: 'acme-labs/xrp-mobile',
      default_branch: 'main',
      private: true,
      archived: false,
      pushed_at: '2026-09-20T10:00:00Z',
    },
    {
      id: 821374924,
      name: 'xrp-web',
      full_name: 'acme-labs/xrp-web',
      default_branch: 'trunk',
      private: false,
      archived: false,
      pushed_at: '2026-09-19T09:00:00Z',
    },
  ],
  branches: {
    'acme-labs/xrp-mobile': ['main', 'release/2026-09', 'fix/wallet-empty-state'],
    'acme-labs/xrp-web': ['trunk', 'next'],
  },
};

function json(response: ServerResponse, status: number, body: unknown) {
  const payload = JSON.stringify(body);
  response.writeHead(status, {
    'content-type': 'application/json',
    'content-length': Buffer.byteLength(payload),
  });
  response.end(payload);
}

export async function startGithubStub(
  overrides: Partial<GithubStubOptions> = {},
): Promise<GithubStub> {
  const options: GithubStubOptions = { ...DEFAULTS, ...overrides };

  /**
   * The installation ids this stub currently knows about.
   *
   * A workspace may connect an installation only once — a second workspace
   * claiming it is `GITHUB_003`, which is the rule, not a limitation — so tests
   * that each sign up a fresh account need an installation each. They add one
   * with `PUT /__stub/installations/{id}` before they connect it, which is what
   * `claimInstallation` below does.
   */
  const installations = new Map<number, ReturnType<typeof installationOf>>();

  function installationOf(id: number) {
    return {
      id,
      account: { login: options.accountLogin, type: 'Organization' },
      repository_selection: 'selected',
      suspended_at: null,
    };
  }

  installations.set(options.installationId, installationOf(options.installationId));

  const server: Server = createServer((request: IncomingMessage, response: ServerResponse) => {
    const url = new URL(request.url ?? '/', 'http://localhost');
    const path = url.pathname;

    // The OAuth exchange. GitHub answers 200 with an `error` member rather than
    // a 4xx, and the adapter reads it that way, so the stub does too.
    if (path === '/login/oauth/access_token') {
      return json(response, 200, { access_token: 'stub-user-token', token_type: 'bearer' });
    }

    // What the account installing the App can see. The connect call trusts this
    // over the installation id it was handed, which is the check being exercised.
    // The one endpoint GitHub does not have: a test saying which installation
    // it is about to connect. Everything below answers GitHub's own shapes.
    const claim = /^\/__stub\/installations\/(\d+)$/.exec(path);
    if (claim && request.method === 'PUT') {
      const id = Number(claim[1]);
      installations.set(id, installationOf(id));
      return json(response, 200, { installations: [...installations.keys()] });
    }

    if (path === '/user/installations') {
      const known = [...installations.values()];
      return json(response, 200, { total_count: known.length, installations: known });
    }

    const byInstallation = /^\/app\/installations\/(\d+)$/.exec(path);
    if (byInstallation) {
      const known = installations.get(Number(byInstallation[1]));
      return known ? json(response, 200, known) : json(response, 404, { message: 'Not Found' });
    }

    if (/^\/app\/installations\/\d+\/access_tokens$/.test(path)) {
      return json(response, 201, {
        token: 'stub-installation-token',
        expires_at: new Date(Date.now() + 3_600_000).toISOString(),
      });
    }

    if (path === '/installation/repositories') {
      return json(response, 200, {
        total_count: options.repositories.length,
        repositories: options.repositories,
      });
    }

    const byId = /^\/repositories\/(\d+)$/.exec(path);
    if (byId) {
      const repository = options.repositories.find((candidate) => candidate.id === Number(byId[1]));
      // A repository the installation does not cover is a 404 from GitHub, and
      // that refusal is what the API turns into `GITHUB_010`.
      return repository
        ? json(response, 200, repository)
        : json(response, 404, { message: 'Not Found' });
    }

    const branches = /^\/repos\/([^/]+)\/([^/]+)\/branches$/.exec(path);
    if (branches) {
      const fullName = `${decodeURIComponent(branches[1] ?? '')}/${decodeURIComponent(branches[2] ?? '')}`;
      const names = options.branches[fullName];
      if (!names) return json(response, 404, { message: 'Not Found' });
      return json(
        response,
        200,
        names.map((name, index) => ({
          name,
          commit: { sha: `${index}`.padStart(40, 'd') },
          protected: index === 0,
        })),
      );
    }

    json(response, 404, { message: `No stub for ${request.method} ${path}` });
  });

  await new Promise<void>((resolve) => server.listen(options.port ?? 0, '127.0.0.1', resolve));
  const address = server.address();
  if (address === null || typeof address === 'string') throw new Error('stub has no port');

  return {
    url: `http://127.0.0.1:${address.port}`,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

/**
 * Run it on its own: `node --experimental-strip-types e2e/support/github-stub.ts`.
 *
 * The API has to be started **with** `GITHUB_APP_API_URL` already pointing at this,
 * so the stub cannot be something a test spins up after the fact — it is part
 * of standing the stack up, like the database.
 */
/**
 * Tell a running stub about an installation id, then hand it back.
 *
 * Each test claims its own, because connecting one is exclusive to a workspace
 * and every test signs up its own account — a second claim is `GITHUB_003`,
 * which is the product's rule rather than something to work around.
 */
export async function claimInstallation(
  stubUrl: string,
  githubInstallationId: number,
): Promise<number> {
  const response = await fetch(`${stubUrl}/__stub/installations/${githubInstallationId}`, {
    method: 'PUT',
  });
  if (!response.ok) throw new Error(`the GitHub stub refused the claim: ${response.status}`);
  return githubInstallationId;
}

if (process.argv[1]?.endsWith('github-stub.ts')) {
  const port = Number(process.env.GITHUB_STUB_PORT ?? 4319);
  startGithubStub({ port }).then((stub) => {
    console.log(`github stub listening on ${stub.url}`);
  });
}
