import type { Command } from 'commander';
import { ApiClient } from './client';
import { type Profile, readConfig, resolveProfile } from './config';
import { NotLoggedInError } from './errors';

/** Global flags, available to every command. */
export interface GlobalOptions {
  apiUrl?: string;
  token?: string;
  profile?: string;
  json?: boolean;
}

export interface CommandContext {
  client: ApiClient;
  profileName: string;
  profile: Profile;
  json: boolean;
}

/**
 * Build the context a command runs in: which profile, which API, and an
 * authenticated client. Commands never read the config or the environment
 * themselves, so the precedence rules live in exactly one place.
 */
export function contextFor(
  command: Command,
  options: { requireAuth?: boolean } = {},
): CommandContext {
  const globals = globalOptions(command);
  const config = readConfig();
  const { name, profile } = resolveProfile({
    config,
    profile: globals.profile,
    apiUrl: globals.apiUrl,
    token: globals.token,
  });

  if (options.requireAuth !== false && !profile.token) throw new NotLoggedInError(name);

  return {
    client: new ApiClient({ apiUrl: profile.apiUrl, token: profile.token }),
    profileName: name,
    profile,
    json: globals.json === true,
  };
}

/** Global flags live on the root program, not on the leaf command. */
export function globalOptions(command: Command): GlobalOptions {
  let root: Command = command;
  while (root.parent) root = root.parent;
  return root.opts<GlobalOptions>();
}
