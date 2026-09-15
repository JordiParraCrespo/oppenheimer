import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { CliError, ExitCode } from './errors';

export interface Profile {
  apiUrl: string;
  /** The API token secret. Stored in a 0600 file, never logged. */
  token?: string;
  /** Id of that token, so `oppenheimer logout` can revoke it server-side. */
  tokenId?: string;
  email?: string;
}

export interface CliConfig {
  currentProfile: string;
  profiles: Record<string, Profile>;
}

export const DEFAULT_API_URL = 'http://localhost:3001';
export const DEFAULT_PROFILE = 'default';

const EMPTY: CliConfig = {
  currentProfile: DEFAULT_PROFILE,
  profiles: {},
};

/**
 * Where the config lives: `$OPPENHEIMER_CONFIG` if set, otherwise
 * `$XDG_CONFIG_HOME/oppenheimer/config.json`, otherwise `~/.config/oppenheimer/config.json`.
 */
export function configPath(env: NodeJS.ProcessEnv = process.env): string {
  if (env.OPPENHEIMER_CONFIG) return env.OPPENHEIMER_CONFIG;
  const base = env.XDG_CONFIG_HOME || join(homedir(), '.config');
  return join(base, 'oppenheimer', 'config.json');
}

export function readConfig(path = configPath()): CliConfig {
  if (!existsSync(path)) return { ...EMPTY, profiles: {} };

  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as Partial<CliConfig>;
    return {
      currentProfile: parsed.currentProfile ?? DEFAULT_PROFILE,
      profiles: parsed.profiles ?? {},
    };
  } catch (error) {
    throw new CliError(
      `Could not read ${path}: ${error instanceof Error ? error.message : String(error)}`,
      ExitCode.FAILURE,
      'Fix or delete the file, then run `oppenheimer login` again.',
    );
  }
}

/** Write the config back, keeping it readable only by its owner. */
export function writeConfig(config: CliConfig, path = configPath()): void {
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  writeFileSync(path, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
  // `writeFileSync`'s mode only applies when creating the file, so an existing
  // one keeps whatever permissions it had — tighten it either way.
  chmodSync(path, 0o600);
}

/**
 * Resolve the profile a command should act as, layering explicit flags over
 * environment variables over the stored profile.
 */
export function resolveProfile(options: {
  config: CliConfig;
  profile?: string;
  apiUrl?: string;
  token?: string;
  env?: NodeJS.ProcessEnv;
}): { name: string; profile: Profile } {
  const env = options.env ?? process.env;
  const name = options.profile ?? env.OPPENHEIMER_PROFILE ?? options.config.currentProfile;
  const stored = options.config.profiles[name];

  return {
    name,
    profile: {
      apiUrl: options.apiUrl ?? env.OPPENHEIMER_API_URL ?? stored?.apiUrl ?? DEFAULT_API_URL,
      token: options.token ?? env.OPPENHEIMER_API_TOKEN ?? stored?.token,
      tokenId: stored?.tokenId,
      email: stored?.email,
    },
  };
}

export function saveProfile(name: string, profile: Profile, path = configPath()): void {
  const config = readConfig(path);
  config.profiles[name] = profile;
  config.currentProfile = name;
  writeConfig(config, path);
}

export function removeProfile(name: string, path = configPath()): void {
  const config = readConfig(path);
  delete config.profiles[name];
  if (config.currentProfile === name) config.currentProfile = DEFAULT_PROFILE;
  writeConfig(config, path);
}
