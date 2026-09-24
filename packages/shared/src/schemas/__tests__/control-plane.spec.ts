import { describe, expect, it } from 'vitest';
import { connectInstallationSchema } from '../github.schema';
import { mintPairingTokenSchema, registerHostSchema, renameHostSchema } from '../host.schema';
import { updateProjectSchema } from '../project.schema';
import {
  addCheckoutSchema,
  createSessionSchema,
  renameSessionSchema,
  sessionGroupSchema,
  sessionStateSchema,
} from '../session.schema';

const uuid = '3f0d9e2c-6a4b-4e9a-9c3d-7b1e5a2f8c40';
const otherUuid = 'a1f2c3d4-5e6f-4a7b-8c9d-0e1f2a3b4c5d';

describe('mintPairingTokenSchema', () => {
  it('accepts a name', () => {
    expect(mintPairingTokenSchema.parse({ name: 'Dev box' })).toEqual({ name: 'Dev box' });
  });

  it('rejects an empty or over-long name', () => {
    expect(mintPairingTokenSchema.safeParse({ name: '' }).success).toBe(false);
    expect(mintPairingTokenSchema.safeParse({ name: 'x'.repeat(81) }).success).toBe(false);
  });
});

describe('registerHostSchema', () => {
  const valid = {
    token: 'oppenheimer_pair_abc123',
    name: 'jordis-mbp',
    publicKey: 'dGhpcyBpcyBub3QgYSByZWFsIGtleQ==',
  };

  /** Exactly what `apps/runner/internal/host/domain/facts.go` marshals. */
  const runnerFacts = {
    platform: 'macos',
    osVersion: '15.3.1',
    arch: 'arm64',
    hostname: 'jordis-mbp',
    user: 'jordi',
    home: '/Users/jordi',
    root: false,
    tools: [
      { name: 'git', path: '/usr/bin/git', version: '2.45.0', required: true },
      { name: 'tmux', path: '/opt/homebrew/bin/tmux', version: '3.5a', required: true },
      { name: 'claude', required: false },
    ],
    workspacePath: '/Users/jordi/oppenheimer-ai',
    diskFreeBytes: 120_000_000_000,
    runnerVersion: '0.4.1',
  };

  it("takes the runner's Facts struct verbatim", () => {
    expect(registerHostSchema.parse({ ...valid, facts: runnerFacts })).toEqual({
      ...valid,
      facts: runnerFacts,
    });
  });

  it('leaves facts optional — a runner that reports nothing still pairs', () => {
    expect(registerHostSchema.parse(valid)).toEqual(valid);
  });

  it('no longer accepts an opaque bag of facts', () => {
    expect(registerHostSchema.safeParse({ ...valid, facts: { anything: 'goes' } }).success).toBe(
      false,
    );
  });

  it('refuses the invented shape no runner ever sent', () => {
    expect(
      registerHostSchema.safeParse({
        ...valid,
        facts: { hostname: 'h', os: 'darwin', arch: 'arm64', tools: {}, agents: [] },
      }).success,
    ).toBe(false);
  });

  it('refuses a platform outside the runner’s own enum', () => {
    expect(
      registerHostSchema.safeParse({ ...valid, facts: { ...runnerFacts, platform: 'windows' } })
        .success,
    ).toBe(false);
  });

  it('accepts `unsupported`, which the runner really does send', () => {
    expect(
      registerHostSchema.safeParse({
        ...valid,
        facts: { ...runnerFacts, platform: 'unsupported' },
      }).success,
    ).toBe(true);
  });

  it('refuses a public key that is not base64', () => {
    expect(registerHostSchema.safeParse({ ...valid, publicKey: 'not base64!' }).success).toBe(
      false,
    );
  });

  it('refuses a missing token', () => {
    expect(registerHostSchema.safeParse({ ...valid, token: '' }).success).toBe(false);
  });
});

describe('renameHostSchema / updateProjectSchema / renameSessionSchema', () => {
  it('take a name and nothing else — no slug is ever renamed', () => {
    expect(renameHostSchema.parse({ name: 'Studio' })).toEqual({ name: 'Studio' });
    expect(updateProjectSchema.parse({ name: 'XRP Mobile' })).toEqual({ name: 'XRP Mobile' });
    expect(renameSessionSchema.parse({ name: 'Fix the picker' })).toEqual({
      name: 'Fix the picker',
    });
  });

  it('reject an empty name', () => {
    expect(renameHostSchema.safeParse({ name: '' }).success).toBe(false);
    expect(updateProjectSchema.safeParse({ name: '' }).success).toBe(false);
    expect(renameSessionSchema.safeParse({ name: '' }).success).toBe(false);
  });
});

describe('connectInstallationSchema', () => {
  it('requires GitHub’s numeric installation id and the OAuth code', () => {
    expect(connectInstallationSchema.parse({ githubInstallationId: 12345, code: 'abc' })).toEqual({
      githubInstallationId: 12345,
      code: 'abc',
    });
    expect(connectInstallationSchema.safeParse({ githubInstallationId: 12345 }).success).toBe(
      false,
    );
    expect(connectInstallationSchema.safeParse({ code: 'abc' }).success).toBe(false);
  });

  it('does not answer to the old `installationId` name', () => {
    expect(
      connectInstallationSchema.safeParse({ installationId: 12345, code: 'abc' }).success,
    ).toBe(false);
  });

  it('rejects a non-positive or fractional id', () => {
    for (const githubInstallationId of [0, -1, 1.5]) {
      expect(connectInstallationSchema.safeParse({ githubInstallationId, code: 'a' }).success).toBe(
        false,
      );
    }
  });
});

describe('the two installation ids cannot be confused', () => {
  it('refuses GitHub’s numeric installation id where a checkout wants our row’s uuid', () => {
    expect(addCheckoutSchema.safeParse({ installationId: 12345, githubRepoId: 7 }).success).toBe(
      false,
    );
    expect(addCheckoutSchema.safeParse({ installationId: '12345', githubRepoId: 7 }).success).toBe(
      false,
    );
  });

  it('refuses our uuid where GitHub’s numeric id belongs', () => {
    expect(
      connectInstallationSchema.safeParse({ githubInstallationId: uuid, code: 'a' }).success,
    ).toBe(false);
  });
});

describe('createSessionSchema', () => {
  it('accepts a host, an agent and one checkout with its own base branch', () => {
    const parsed = createSessionSchema.parse({
      hostId: uuid,
      agent: 'claude-code',
      checkouts: [{ installationId: otherUuid, githubRepoId: 43, baseBranch: 'develop' }],
      cwdGithubRepoId: 43,
    });
    expect(parsed.checkouts).toHaveLength(1);
    expect(parsed.checkouts[0].baseBranch).toBe('develop');
  });

  it('refuses a second repository: a session checks out one in the MVP (#56)', () => {
    const result = createSessionSchema.safeParse({
      hostId: uuid,
      agent: 'claude-code',
      checkouts: [
        { installationId: otherUuid, githubRepoId: 42 },
        { installationId: otherUuid, githubRepoId: 43 },
      ],
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0].path).toEqual(['checkouts']);
  });

  it('accepts no checkouts at all — a session with no git is a real session', () => {
    expect(
      createSessionSchema.parse({ hostId: uuid, agent: 'codex', checkouts: [] }).checkouts,
    ).toEqual([]);
  });

  it('takes no branch: the working branch is always the session’s own', () => {
    const parsed = createSessionSchema.parse({
      hostId: uuid,
      agent: 'codex',
      checkouts: [{ installationId: otherUuid, githubRepoId: 42, baseBranch: 'main' }],
    });
    expect(parsed.checkouts[0]).not.toHaveProperty('branch');
  });

  it('refuses an agent outside the catalog', () => {
    expect(
      createSessionSchema.safeParse({ hostId: uuid, agent: 'cursor', checkouts: [] }).success,
    ).toBe(false);
  });

  it('refuses a host or installation id that is not a uuid', () => {
    expect(
      createSessionSchema.safeParse({ hostId: 'host-1', agent: 'codex', checkouts: [] }).success,
    ).toBe(false);
    expect(
      createSessionSchema.safeParse({
        hostId: uuid,
        agent: 'codex',
        checkouts: [{ installationId: 'inst-1', githubRepoId: 42 }],
      }).success,
    ).toBe(false);
  });

  it('refuses a repository id that is not a positive integer', () => {
    for (const githubRepoId of [0, -1, 1.5]) {
      expect(
        createSessionSchema.safeParse({
          hostId: uuid,
          agent: 'codex',
          checkouts: [{ installationId: otherUuid, githubRepoId }],
        }).success,
      ).toBe(false);
    }
  });

  it('refuses a missing checkouts array — empty is explicit, absent is a mistake', () => {
    expect(createSessionSchema.safeParse({ hostId: uuid, agent: 'codex' }).success).toBe(false);
  });

  describe('cwdGithubRepoId must name a posted checkout', () => {
    it('accepts a cwd that is one of them', () => {
      expect(
        createSessionSchema.safeParse({
          hostId: uuid,
          agent: 'codex',
          checkouts: [{ installationId: otherUuid, githubRepoId: 42 }],
          cwdGithubRepoId: 42,
        }).success,
      ).toBe(true);
    });

    it('refuses a cwd that is not', () => {
      const result = createSessionSchema.safeParse({
        hostId: uuid,
        agent: 'codex',
        checkouts: [{ installationId: otherUuid, githubRepoId: 42 }],
        cwdGithubRepoId: 99,
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toEqual(['cwdGithubRepoId']);
      }
    });

    it('refuses a cwd when there are no checkouts at all', () => {
      expect(
        createSessionSchema.safeParse({
          hostId: uuid,
          agent: 'codex',
          checkouts: [],
          cwdGithubRepoId: 42,
        }).success,
      ).toBe(false);
    });

    it('leaves a session with no cwd alone', () => {
      expect(
        createSessionSchema.safeParse({ hostId: uuid, agent: 'codex', checkouts: [] }).success,
      ).toBe(true);
    });
  });
});

describe('addCheckoutSchema', () => {
  it('is one checkout, the same shape create takes', () => {
    expect(addCheckoutSchema.parse({ installationId: otherUuid, githubRepoId: 7 })).toEqual({
      installationId: otherUuid,
      githubRepoId: 7,
    });
    expect(addCheckoutSchema.safeParse({ githubRepoId: 7 }).success).toBe(false);
  });
});

describe('the three state vocabularies stay apart', () => {
  it('stores only the four lifecycle values', () => {
    for (const state of ['starting', 'open', 'failed', 'resolved']) {
      expect(sessionStateSchema.parse(state)).toBe(state);
    }
  });

  it('never stores an agent observation as a session state', () => {
    for (const observation of ['working', 'blocked', 'idle', 'done', 'unknown']) {
      expect(sessionStateSchema.safeParse(observation).success).toBe(false);
    }
  });

  it('derives six groups, organised by what needs you', () => {
    for (const group of [
      'working',
      'waiting-on-you',
      'ready-for-review',
      'landing',
      'idle',
      'resolved',
    ]) {
      expect(sessionGroupSchema.parse(group)).toBe(group);
    }
    expect(sessionGroupSchema.safeParse('blocked').success).toBe(false);
    expect(sessionGroupSchema.safeParse('starting').success).toBe(false);
  });
});
