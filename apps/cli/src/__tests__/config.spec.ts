import { mkdtempSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  configPath,
  DEFAULT_API_URL,
  readConfig,
  removeProfile,
  resolveProfile,
  saveProfile,
  writeConfig,
} from '../lib/config';

let dir: string;
let path: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'oppenheimer-cli-'));
  path = join(dir, 'config.json');
});

describe('configPath', () => {
  it('prefers an explicit OPPENHEIMER_CONFIG', () => {
    expect(configPath({ OPPENHEIMER_CONFIG: '/tmp/custom.json' })).toBe('/tmp/custom.json');
  });

  it('falls back to XDG_CONFIG_HOME', () => {
    expect(configPath({ XDG_CONFIG_HOME: '/xdg' })).toBe('/xdg/oppenheimer/config.json');
  });

  it('finally falls back to ~/.config', () => {
    expect(configPath({})).toMatch(/\.config\/oppenheimer\/config\.json$/);
  });
});

describe('reading and writing', () => {
  it('returns an empty config when the file does not exist', () => {
    expect(readConfig(path)).toEqual({
      currentProfile: 'default',
      profiles: {},
    });
  });

  it('round-trips a profile', () => {
    saveProfile('work', { apiUrl: 'https://api.example.com', token: 'oppenheimer_pat_x' }, path);

    const config = readConfig(path);
    expect(config.currentProfile).toBe('work');
    expect(config.profiles.work.apiUrl).toBe('https://api.example.com');
  });

  it('stores the file readable only by its owner', () => {
    saveProfile('work', { apiUrl: DEFAULT_API_URL, token: 'secret' }, path);
    expect(statSync(path).mode & 0o777).toBe(0o600);
  });

  it('tightens permissions on a file that already existed', () => {
    writeFileSync(path, '{}', { mode: 0o644 });
    writeConfig({ currentProfile: 'default', profiles: {} }, path);
    expect(statSync(path).mode & 0o777).toBe(0o600);
  });

  it('keeps other profiles when one is saved', () => {
    saveProfile('a', { apiUrl: 'https://a.example.com' }, path);
    saveProfile('b', { apiUrl: 'https://b.example.com' }, path);

    expect(Object.keys(readConfig(path).profiles).sort()).toEqual(['a', 'b']);
  });

  it('removes a profile and resets the current one', () => {
    saveProfile('work', { apiUrl: DEFAULT_API_URL, token: 'x' }, path);
    removeProfile('work', path);

    const config = readConfig(path);
    expect(config.profiles.work).toBeUndefined();
    expect(config.currentProfile).toBe('default');
  });

  it('explains a corrupt config instead of crashing', () => {
    writeFileSync(path, 'not json');
    expect(() => readConfig(path)).toThrow(/Could not read/);
  });

  it('writes valid JSON with a trailing newline', () => {
    saveProfile('work', { apiUrl: DEFAULT_API_URL }, path);
    const raw = readFileSync(path, 'utf8');

    expect(raw.endsWith('\n')).toBe(true);
    expect(() => JSON.parse(raw)).not.toThrow();
  });
});

describe('resolveProfile', () => {
  const config = {
    currentProfile: 'work',
    profiles: {
      work: {
        apiUrl: 'https://work.example.com',
        token: 'work-token',
        email: 'a@b.c',
      },
      home: { apiUrl: 'https://home.example.com', token: 'home-token' },
    },
  };

  it('uses the stored current profile by default', () => {
    const { name, profile } = resolveProfile({ config, env: {} });
    expect(name).toBe('work');
    expect(profile.token).toBe('work-token');
  });

  it('lets a flag pick a different profile', () => {
    const { name, profile } = resolveProfile({
      config,
      profile: 'home',
      env: {},
    });
    expect(name).toBe('home');
    expect(profile.token).toBe('home-token');
  });

  it('lets the environment pick a profile', () => {
    expect(resolveProfile({ config, env: { OPPENHEIMER_PROFILE: 'home' } }).name).toBe('home');
  });

  it('puts a flag ahead of the environment', () => {
    const { name } = resolveProfile({
      config,
      profile: 'work',
      env: { OPPENHEIMER_PROFILE: 'home' },
    });
    expect(name).toBe('work');
  });

  it('overrides the token and URL from flags', () => {
    const { profile } = resolveProfile({
      config,
      apiUrl: 'https://override.example.com',
      token: 'override-token',
      env: {},
    });

    expect(profile.apiUrl).toBe('https://override.example.com');
    expect(profile.token).toBe('override-token');
  });

  it('reads the token from the environment when no flag is given', () => {
    const { profile } = resolveProfile({
      config,
      env: { OPPENHEIMER_API_TOKEN: 'env-token' },
    });
    expect(profile.token).toBe('env-token');
  });

  it('falls back to the default API URL for an unknown profile', () => {
    const { profile } = resolveProfile({ config, profile: 'nope', env: {} });
    expect(profile.apiUrl).toBe(DEFAULT_API_URL);
    expect(profile.token).toBeUndefined();
  });
});
