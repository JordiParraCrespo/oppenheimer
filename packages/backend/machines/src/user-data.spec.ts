import { describe, expect, it } from 'vitest';
import { runnerCloudConfig } from './user-data';

const options = {
  controlPlaneUrl: 'https://app.example.dev',
  pairingToken: "opr_it's",
  installScriptUrl: 'https://get.example.dev/install.sh',
  hostName: 'aws eu-central-1',
};

describe('runnerCloudConfig', () => {
  it('enables the lingering user manager before running the installer as the user', () => {
    const config = runnerCloudConfig(options);
    const linger = config.indexOf('["loginctl", "enable-linger", "agent"]');
    const install = config.indexOf('["runuser", "-u", "agent"');
    expect(linger).toBeGreaterThan(-1);
    expect(install).toBeGreaterThan(linger);
    expect(config).toContain('DBUS_SESSION_BUS_ADDRESS=unix:path=/run/user/$uid/bus');
  });

  it('quotes the token and the name for the shell', () => {
    const config = runnerCloudConfig(options);
    const line = config.split('\n').find((l) => l.includes('runuser')) ?? '';
    const argv = JSON.parse(line.trim().slice(2)) as string[];
    expect(argv.slice(0, 6)).toEqual(['runuser', '-u', 'agent', '--', 'sh', '-c']);
    expect(argv[6]).toContain(`--token 'opr_it'\\''s'`);
    expect(argv[6]).toContain(`--name 'aws eu-central-1'`);
    expect(argv[6]).toContain('XDG_RUNTIME_DIR=/run/user/$uid');
  });

  it('starts with the cloud-config marker and creates a locked, non-sudo user', () => {
    const config = runnerCloudConfig(options);
    expect(config.startsWith('#cloud-config\n')).toBe(true);
    expect(config).toContain('sudo: false');
    expect(config).toContain('lock_passwd: true');
  });

  it('can skip the Claude Code install for a prebaked image', () => {
    const config = runnerCloudConfig({ ...options, installClaudeCode: false });
    expect(config).not.toContain('@anthropic-ai/claude-code');
  });
});
