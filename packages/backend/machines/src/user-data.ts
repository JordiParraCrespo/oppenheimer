/**
 * The cloud-config that turns a fresh machine into a paired host: create the
 * user, install what the runner needs, and run the ordinary installer with a
 * one-hour pairing token (product/versions/mvp/09 §2, "From cloud-init").
 *
 * cloud-init runs as root and the installer refuses root; and `runner install`
 * needs a systemd user session, which a plain `runuser` has not got. So the
 * user's lingering manager is enabled first and the installer runs with the
 * user's runtime environment set.
 */
export interface RunnerCloudConfigOptions {
  /** The control plane's URL, as the install command shows it. */
  controlPlaneUrl: string;
  /** The one-hour, single-use pairing token. Never anything longer-lived. */
  pairingToken: string;
  /** The URL of the installer script. */
  installScriptUrl: string;
  /** The Unix user that owns the sessions. Default `agent`. */
  user?: string;
  /** A name the host adopts at registration. */
  hostName?: string;
  /** Extra apt packages beside git and tmux. */
  packages?: string[];
  /** Whether to install Node and Claude Code; on by default. */
  installClaudeCode?: boolean;
}

export function runnerCloudConfig(options: RunnerCloudConfigOptions): string {
  const user = options.user ?? 'agent';
  const packages = ['git', 'tmux', 'curl', 'ca-certificates', ...(options.packages ?? [])];
  const install = [
    `curl -fsSL ${shellQuote(options.installScriptUrl)} | sh -s --`,
    `--token ${shellQuote(options.pairingToken)}`,
    `--url ${shellQuote(options.controlPlaneUrl)}`,
    ...(options.hostName ? [`--name ${shellQuote(options.hostName)}`] : []),
  ].join(' ');
  // Run as the user with the user manager's runtime environment; the uid is
  // read inside the shell so nothing here has to know it.
  const asUser = [
    'uid=$(id -u)',
    `export HOME=/home/${user} XDG_RUNTIME_DIR=/run/user/$uid DBUS_SESSION_BUS_ADDRESS=unix:path=/run/user/$uid/bus`,
    install,
  ].join('; ');

  // Each runcmd entry is an argv list, so cloud-init execs it without a shell
  // and the install line is quoted exactly once, inside its own `sh -c`.
  const runcmd: string[][] = [];
  if (options.installClaudeCode ?? true) {
    runcmd.push(
      ['sh', '-c', 'curl -fsSL https://deb.nodesource.com/setup_22.x | bash -'],
      ['apt-get', 'install', '-y', 'nodejs'],
      ['npm', 'install', '-g', '@anthropic-ai/claude-code'],
    );
  }
  runcmd.push(
    ['loginctl', 'enable-linger', user],
    ['runuser', '-u', user, '--', 'sh', '-c', asUser],
  );

  return [
    '#cloud-config',
    'users:',
    `  - name: ${user}`,
    '    shell: /bin/bash',
    '    sudo: false',
    '    lock_passwd: true',
    'package_update: true',
    'packages:',
    ...packages.map((p) => `  - ${p}`),
    'runcmd:',
    ...runcmd.map((argv) => `  - [${argv.map(yamlQuote).join(', ')}]`),
    '',
  ].join('\n');
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function yamlQuote(value: string): string {
  return JSON.stringify(value);
}
