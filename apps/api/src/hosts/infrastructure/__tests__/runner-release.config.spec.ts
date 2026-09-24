import type { ConfigService } from '@nestjs/config';
import { describe, expect, it } from 'vitest';
import { RunnerReleaseConfig } from '../runner-release.config';

const SECRET = 'opr_reg_0123456789abcdefghijklmnopqrstuvwxyzABCDEFG';
const DIGEST = 'ab'.repeat(32);

function release(overrides: Record<string, unknown> = {}): RunnerReleaseConfig {
  const values: Record<string, unknown> = {
    'hosts.controlPlaneUrl': 'https://app.oppenheimer.dev',
    'hosts.releaseBaseUrl': 'https://get.oppenheimer.dev/releases',
    'hosts.releaseChannel': 'stable',
    'hosts.installUrl': 'https://get.oppenheimer.dev/install.sh',
    'hosts.installSha256': DIGEST,
    ...overrides,
  };
  return new RunnerReleaseConfig({ get: (key: string) => values[key] } as unknown as ConfigService);
}

describe('RunnerReleaseConfig.installCommandFor', () => {
  it('puts the token in the installer’s environment, never on a command line', () => {
    const command = release().installCommandFor(SECRET);

    expect(command).toContain(`| OPPENHEIMER_REGISTRATION_TOKEN=${SECRET} sh -s -- `);
    expect(command).not.toContain('--token');
  });

  it('pins the download to HTTPS and TLS 1.2 or newer', () => {
    expect(release().installCommandFor(SECRET)).toMatch(
      /^curl --proto '=https' --tlsv1\.2 -fsSL https:\/\/get\.oppenheimer\.dev\/install\.sh \|/,
    );
  });

  it('leaves a plain-HTTP development installer unpinned, which --proto would refuse', () => {
    const command = release({
      'hosts.installUrl': 'http://localhost:3001/install.sh',
    }).installCommandFor(SECRET);
    expect(command).toMatch(/^curl -fsSL http:\/\/localhost:3001\/install\.sh \|/);
  });

  it('names the release base, and the channel only when it is not the default', () => {
    expect(release().installCommandFor(SECRET)).toContain(
      '--url https://app.oppenheimer.dev --release-base https://get.oppenheimer.dev/releases',
    );
    expect(release({ 'hosts.releaseChannel': 'beta' }).installCommandFor(SECRET)).toContain(
      '--channel beta',
    );
  });
});

describe('RunnerReleaseConfig.agentPromptFor', () => {
  const prompt = release().agentPromptFor(SECRET);

  it('establishes the machine and asks before anything is run', () => {
    const step0 = prompt.indexOf('STEP 0');
    const step1 = prompt.indexOf('STEP 1');
    expect(step0).toBeGreaterThan(-1);
    expect(step0).toBeLessThan(step1);
    expect(prompt).toContain('Is this');
    expect(prompt).toContain('Ask me where session code should live');
    expect(prompt).toContain('--workspaces');
  });

  it('names the codes the runner actually reports, and not a status exit code it does not', () => {
    for (const code of ['HOST_006', 'HOST_007', 'PAIR_002', 'PAIR_003', 'PAIR_006', 'PAIR_007']) {
      expect(prompt).toContain(code);
    }
    expect(prompt).toContain('do not rely on its exit code');
  });

  it('quotes the installer digest when the deployment published one', () => {
    expect(prompt).toContain(DIGEST);
    expect(release({ 'hosts.installSha256': undefined }).agentPromptFor(SECRET)).not.toContain(
      'SHA-256 is',
    );
  });

  it('keeps the SSH form on one line, with the token on stdin', () => {
    const ssh = prompt.split('\n').find((line) => line.includes('| ssh <target>'));
    expect(ssh).toBeDefined();
    // A literal \n for printf, not a line break in the middle of the command.
    expect(ssh).toContain(`printf '%s\\n' '${SECRET}'`);
    expect(ssh).toContain('read -r OPPENHEIMER_REGISTRATION_TOKEN');
    expect(ssh).not.toContain(`OPPENHEIMER_REGISTRATION_TOKEN=${SECRET}`);
  });

  it('never offers the removed --yes', () => {
    expect(prompt).not.toMatch(/--yes|--no-deps/);
  });
});
