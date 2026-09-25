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
  it('passes the token as an environment assignment, never as an argument', () => {
    const command = release().installCommandFor(SECRET);

    // The assignment is on the pasted line; what `sh` and the installer
    // receive as argv is everything after `sh -s --`, and the token is not in it.
    expect(command).toContain(`| OPPENHEIMER_REGISTRATION_TOKEN=${SECRET} sh -s -- `);
    const argv = command.slice(command.indexOf('sh -s --'));
    expect(argv).not.toContain(SECRET);
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

  it('asks which machine and which path before anything is run', () => {
    expect(prompt.indexOf('Before you run anything')).toBeLessThan(prompt.indexOf('Then run'));
    expect(prompt).toContain('is the one I mean');
    expect(prompt).toContain('--workspaces');
  });

  it('carries the secret once, inside the install command', () => {
    expect(prompt.split(SECRET)).toHaveLength(2);
    expect(prompt).toContain(release().installCommandFor(SECRET));
  });

  it('quotes the installer digest when the deployment published one', () => {
    expect(prompt).toContain(DIGEST);
    expect(release({ 'hosts.installSha256': undefined }).agentPromptFor(SECRET)).not.toContain(
      'SHA-256',
    );
  });

  it('leaves the procedure to the installer and the runner', () => {
    // No error-code table, and no console action version 1 does not have.
    expect(prompt).not.toMatch(/[A-Z]+_\d{3}/);
    expect(prompt).not.toMatch(/console|Settings|unpair/i);
    expect(prompt).not.toMatch(/--yes|--no-deps/);
  });
});
