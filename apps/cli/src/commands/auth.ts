import { hostname } from 'node:os';
import { normalizeScopes, type Scope, sortScopes } from '@oppenheimer/shared';
import { Command } from 'commander';
import type { CreatedApiToken, CurrentCredential, PermissionCatalog } from '../lib/api-types';
import { ApiClient } from '../lib/client';
import {
  DEFAULT_API_URL,
  readConfig,
  removeProfile,
  resolveProfile,
  saveProfile,
} from '../lib/config';
import { contextFor, globalOptions } from '../lib/context';
import { CliError, ExitCode } from '../lib/errors';
import { formatDate, formatList, render, style, success, table, warn } from '../lib/output';
import { ask, askSecret } from '../lib/prompt';

export function authCommands(): Command[] {
  return [loginCommand(), logoutCommand(), whoamiCommand()];
}

function loginCommand(): Command {
  return new Command('login')
    .description('Authenticate this machine and store a scoped API token')
    .option('--email <email>', 'Email address to sign in with')
    .option('--password <password>', 'Password (prompted for when omitted)')
    .option('--with-token <token>', 'Store an existing API token instead of signing in')
    .option(
      '--permissions <scopes>',
      'Comma-separated scopes for the token this creates (default: everything you may grant)',
    )
    .option('--name <name>', 'Name for the token this creates')
    .action(async function (this: Command) {
      const options = this.opts<{
        email?: string;
        password?: string;
        withToken?: string;
        permissions?: string;
        name?: string;
      }>();
      const globals = globalOptions(this);
      const config = readConfig();
      const { name: profileName, profile } = resolveProfile({
        config,
        profile: globals.profile,
        apiUrl: globals.apiUrl,
      });

      const apiUrl = globals.apiUrl ?? profile.apiUrl ?? (await askApiUrl());

      const minted = options.withToken
        ? { token: options.withToken, tokenId: undefined }
        : await mintToken({ apiUrl, options });

      // Confirm the credential works, and learn who it is, before storing it.
      const credential = await new ApiClient({
        apiUrl,
        token: minted.token,
      }).get<CurrentCredential>('/me/credential');

      saveProfile(profileName, {
        apiUrl,
        token: minted.token,
        tokenId: minted.tokenId,
        email: credential.email,
      });

      success(
        `Logged in as ${style.bold(credential.email)} on profile ${style.bold(profileName)}.`,
      );
      process.stdout.write(
        `${style.dim('Permissions:')} ${formatList(credential.effectiveScopes, 'none')}\n`,
      );
    });
}

/** Prompt for the API URL, defaulting to the local development server. */
async function askApiUrl(): Promise<string> {
  const answer = await ask(`API URL [${DEFAULT_API_URL}]: `);
  return answer || DEFAULT_API_URL;
}

/**
 * Sign in with email and password, then immediately trade that session for a
 * scoped API token — the session is never stored, so a leaked config file
 * exposes a credential that is both narrower and revocable.
 */
async function mintToken(input: {
  apiUrl: string;
  options: {
    email?: string;
    password?: string;
    permissions?: string;
    name?: string;
  };
}): Promise<{ token: string; tokenId: string }> {
  const email = input.options.email ?? (await ask('Email: '));
  const password = input.options.password ?? (await askSecret('Password: '));

  let sessionToken: string | undefined;
  await new ApiClient({ apiUrl: input.apiUrl }).post('/api/auth/sign-in/email', {
    absolute: true,
    body: { email, password },
    headers: { 'x-oppenheimer-cli': '1' },
    onHeaders: (headers) => {
      // The Better Auth bearer plugin returns the session token in this header
      // rather than a cookie, which is exactly what a CLI needs.
      sessionToken = headers.get('set-auth-token') ?? undefined;
    },
  });

  if (!sessionToken) {
    throw new CliError(
      'Signed in, but the API did not return a session token.',
      ExitCode.AUTH,
      'Check that the Better Auth `bearer` plugin is enabled on the API.',
    );
  }

  const session = new ApiClient({ apiUrl: input.apiUrl, token: sessionToken });
  const catalog = await session.get<PermissionCatalog>('/tokens/permissions');
  const scopes = chooseScopes(input.options.permissions, catalog.grantable);

  const created = await session.post<CreatedApiToken>('/tokens', {
    body: {
      name: input.options.name ?? `oppenheimer-cli on ${hostname()}`,
      scopes,
    },
  });

  return { token: created.token, tokenId: created.id };
}

/** Requested scopes, validated against what this user may actually grant. */
function chooseScopes(requested: string | undefined, grantable: Scope[]): Scope[] {
  if (!requested) {
    if (grantable.length === 0) {
      throw new CliError(
        'Your account cannot grant any permissions, so no token can be created.',
        ExitCode.FORBIDDEN,
      );
    }
    return grantable;
  }

  const { scopes, unknown } = normalizeScopes(requested.split(','));
  if (unknown.length > 0) {
    throw new CliError(
      `Unknown permission${unknown.length > 1 ? 's' : ''}: ${unknown.join(', ')}`,
      ExitCode.USAGE,
      'Run `oppenheimer tokens permissions` to see the catalog.',
    );
  }

  const allowed = new Set(grantable);
  const refused = scopes.filter((scope) => !allowed.has(scope));
  if (refused.length > 0) {
    throw new CliError(
      `You cannot grant: ${refused.join(', ')}`,
      ExitCode.FORBIDDEN,
      'A token can never carry more than its creator holds.',
    );
  }

  return sortScopes(scopes);
}

function logoutCommand(): Command {
  return new Command('logout')
    .description('Revoke the stored token and forget this profile')
    .option('--keep-token', 'Forget the token locally without revoking it server-side')
    .action(async function (this: Command) {
      const { keepToken } = this.opts<{ keepToken?: boolean }>();
      const context = contextFor(this, { requireAuth: false });

      if (!context.profile.token) {
        warn(`Profile "${context.profileName}" is not logged in.`);
        return;
      }

      if (!keepToken && context.profile.tokenId) {
        try {
          await context.client.delete(`/tokens/${context.profile.tokenId}`);
        } catch (error) {
          // A token that is already gone is not a reason to leave the local
          // config pointing at it.
          warn(
            `Could not revoke the token: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      } else if (!keepToken) {
        warn('This profile stores a token that was supplied directly; revoke it in the dashboard.');
      }

      removeProfile(context.profileName);
      success(`Logged out of profile ${style.bold(context.profileName)}.`);
    });
}

function whoamiCommand(): Command {
  return new Command('whoami')
    .description('Show the current credential and what it can do')
    .action(async function (this: Command) {
      const context = contextFor(this);
      const credential = await context.client.get<CurrentCredential>('/me/credential');

      render(context.json, credential, () =>
        [
          `${style.bold(credential.email)} ${style.dim(`(${credential.userId})`)}`,
          `${style.dim('Profile:    ')} ${context.profileName} → ${context.profile.apiUrl}`,
          `${style.dim('Credential: ')} ${credential.kind}`,
          `${style.dim('Granted:    ')} ${formatList(credential.grantedScopes, 'unrestricted (session)')}`,
          `${style.dim('Effective:  ')} ${formatList(credential.effectiveScopes, 'none')}`,
          `${style.dim('Orgs:       ')} ${formatList(credential.organizationIds, 'all')}`,
          `${style.dim('Expires:    ')} ${formatDate(credential.expiresAt)}`,
        ].join('\n'),
      );

      if (
        credential.grantedScopes &&
        credential.grantedScopes.length > credential.effectiveScopes.length
      ) {
        const inert = credential.grantedScopes.filter(
          (scope) => !credential.effectiveScopes.includes(scope),
        );
        warn(`Granted but currently inert (your roles no longer allow them): ${inert.join(', ')}`);
      }
    });
}

/** Exported for the tests, which exercise scope validation directly. */
export const __testing = { chooseScopes, table };
