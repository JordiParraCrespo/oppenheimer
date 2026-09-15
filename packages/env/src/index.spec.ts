import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { findWorkspaceRoot, loadEnv } from './index';

let root: string;
let touchedKeys: string[];

function makeWorkspace(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'oppenheimer-env-'));
  fs.writeFileSync(path.join(dir, 'pnpm-workspace.yaml'), 'packages:\n  - "packages/*"\n');
  fs.mkdirSync(path.join(dir, 'packages', 'nested'), { recursive: true });
  return dir;
}

beforeEach(() => {
  root = makeWorkspace();
  touchedKeys = [];
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
  for (const key of touchedKeys) {
    delete process.env[key];
  }
});

function write(filename: string, content: string, keys: string[]): void {
  fs.writeFileSync(path.join(root, filename), content);
  touchedKeys.push(...keys);
}

describe('findWorkspaceRoot', () => {
  it('finds a pnpm workspace root from a nested directory', () => {
    expect(findWorkspaceRoot(path.join(root, 'packages', 'nested'))).toBe(root);
  });

  it('finds a package.json with a workspaces field', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'oppenheimer-env-npm-'));
    try {
      fs.writeFileSync(
        path.join(dir, 'package.json'),
        JSON.stringify({ workspaces: ['packages/*'] }),
      );
      fs.mkdirSync(path.join(dir, 'deep'));
      expect(findWorkspaceRoot(path.join(dir, 'deep'))).toBe(dir);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('ignores a package.json without workspaces and keeps walking', () => {
    fs.writeFileSync(
      path.join(root, 'packages', 'nested', 'package.json'),
      JSON.stringify({ name: 'nested' }),
    );
    expect(findWorkspaceRoot(path.join(root, 'packages', 'nested'))).toBe(root);
  });

  it('returns null when no workspace root exists', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'oppenheimer-env-none-'));
    try {
      expect(findWorkspaceRoot(dir)).toBeNull();
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('loadEnv', () => {
  it('loads .env from the workspace root, from any nested cwd', () => {
    write('.env', 'OPPENHEIMER_ENV_TEST_A=from-dotenv\n', ['OPPENHEIMER_ENV_TEST_A']);
    const result = loadEnv({ cwd: path.join(root, 'packages', 'nested') });
    expect(result.root).toBe(root);
    expect(result.applied).toContain('OPPENHEIMER_ENV_TEST_A');
    expect(process.env.OPPENHEIMER_ENV_TEST_A).toBe('from-dotenv');
  });

  it('lets .env.local override .env', () => {
    write('.env', 'OPPENHEIMER_ENV_TEST_B=base\n', ['OPPENHEIMER_ENV_TEST_B']);
    write('.env.local', 'OPPENHEIMER_ENV_TEST_B=local\n', []);
    loadEnv({ cwd: root });
    expect(process.env.OPPENHEIMER_ENV_TEST_B).toBe('local');
  });

  it('never overwrites a value already in process.env', () => {
    process.env.OPPENHEIMER_ENV_TEST_C = 'real-env';
    touchedKeys.push('OPPENHEIMER_ENV_TEST_C');
    write('.env', 'OPPENHEIMER_ENV_TEST_C=from-file\n', []);
    const result = loadEnv({ cwd: root });
    expect(process.env.OPPENHEIMER_ENV_TEST_C).toBe('real-env');
    expect(result.applied).not.toContain('OPPENHEIMER_ENV_TEST_C');
  });

  it('is a no-op outside any workspace', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'oppenheimer-env-outside-'));
    try {
      expect(loadEnv({ cwd: dir })).toEqual({
        root: null,
        loaded: [],
        applied: [],
      });
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('tolerates missing files and reports what it read', () => {
    write('.env.local', 'OPPENHEIMER_ENV_TEST_D=only-local\n', ['OPPENHEIMER_ENV_TEST_D']);
    const result = loadEnv({ cwd: root });
    expect(result.loaded).toEqual([path.join(root, '.env.local')]);
    expect(process.env.OPPENHEIMER_ENV_TEST_D).toBe('only-local');
  });
});
