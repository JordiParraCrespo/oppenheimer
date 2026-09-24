import { execFileSync, spawn } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { hostname, tmpdir, userInfo } from 'node:os';
import { join } from 'node:path';
import { API_URL } from '../playwright.config';
import type { FleetHost } from './fleet';

/**
 * The fleet's hosts on the machine running the suite (`FLEET_HOSTS=local`),
 * for machines that run no containers or cannot build the fleet's image — a
 * cloud sandbox, typically, whose egress stops at a loopback proxy a build
 * container cannot reach.
 *
 * Everything that makes a host a host is the container transport's: the same
 * runner build, `e2e/fleet/git-server.sh` seeding the same repositories, the
 * same `claude` shim, and pairing through the real API by `support/fleet.ts`'s
 * callers. What differs is only where it runs:
 *
 * - as root, each host is a Unix account of its own, because `runner register`
 *   refuses root — which is also the shape of a real machine. Accounts carry
 *   `ACCOUNT_MARK` as their comment, and teardown removes every account that
 *   carries it and no other;
 * - as anyone else, each host is the caller with a HOME and a tmux directory
 *   of its own, so hosts never share an identity or a tmux server;
 * - the git server binds loopback, and a host's `PATH` is its own bin dir in
 *   front of the caller's, so tools found here are found by the runner too.
 *
 * A host here cannot lose its network alone (`cutLink`): the tests that need
 * that run on containers.
 */
const ROOT = process.env.FLEET_LOCAL_DIR ?? join(tmpdir(), 'oppenheimer-fleet-local');
/**
 * One record per host, written once: the fleet's workers are separate
 * processes, and a shared file rewritten by each would lose a record — and
 * with it the host teardown has to stop.
 */
const RECORDS = join(ROOT, 'hosts');
const ACCOUNT_MARK = 'oppenheimer fleet host';
const isRoot = process.getuid?.() === 0;

interface LocalRecord {
  name: string;
  user: string;
  home: string;
  supervisor: number;
}

function records(): LocalRecord[] {
  if (!existsSync(RECORDS)) return [];
  return readdirSync(RECORDS)
    .filter((file) => file.endsWith('.json'))
    .map((file) => JSON.parse(readFileSync(join(RECORDS, file), 'utf8')) as LocalRecord);
}

function remember(record: LocalRecord): void {
  mkdirSync(RECORDS, { recursive: true });
  writeFileSync(join(RECORDS, `${record.name}.json`), JSON.stringify(record, null, 2));
}

function hostEnv(home: string): Record<string, string> {
  return {
    HOME: home,
    PATH: `${join(home, 'bin')}:${process.env.PATH ?? '/usr/bin:/bin'}`,
    TMUX_TMPDIR: join(home, '.tmux'),
  };
}

/** argv that runs `argv` as the host. */
function asHost(record: Pick<LocalRecord, 'user' | 'home'>, argv: string[]): [string, string[]] {
  const env = Object.entries(hostEnv(record.home)).map(([key, value]) => `${key}=${value}`);
  return isRoot
    ? ['runuser', ['-u', record.user, '--', 'env', ...env, ...argv]]
    : ['env', [...env, ...argv]];
}

function runAs(record: Pick<LocalRecord, 'user' | 'home'>, argv: string[]): string {
  const [command, args] = asHost(record, argv);
  return execFileSync(command, args, { encoding: 'utf8' }).trim();
}

function detached(command: string, args: string[], log: string): number {
  const child = spawn('sh', ['-c', 'exec "$@" >>"$0" 2>&1', log, command, ...args], {
    detached: true,
    stdio: 'ignore',
  });
  child.unref();
  return child.pid as number;
}

function accountComment(user: string): string | undefined {
  try {
    return execFileSync('getent', ['passwd', user], { encoding: 'utf8' }).split(':')[4];
  } catch {
    return undefined;
  }
}

/** The runner and the shim in `ROOT/bin`, and the git server on loopback. */
export function buildLocalFleet(repoRoot: string): void {
  teardownLocalFleet();
  mkdirSync(join(ROOT, 'bin'), { recursive: true });
  execFileSync('go', ['build', '-trimpath', '-o', join(ROOT, 'bin', 'runner'), './cmd/runner'], {
    cwd: join(repoRoot, 'apps', 'runner'),
    env: { ...process.env, CGO_ENABLED: '0' },
    stdio: 'inherit',
  });
  copyFileSync(join(repoRoot, 'e2e', 'fleet', 'claude'), join(ROOT, 'bin', 'claude'));
  execFileSync('chmod', ['0755', join(ROOT, 'bin', 'claude'), join(ROOT, 'bin', 'runner')]);
  const pid = detached(
    'env',
    [
      `GIT_ROOT=${join(ROOT, 'git')}`,
      'GIT_LISTEN=127.0.0.1',
      'bash',
      join(repoRoot, 'e2e', 'fleet', 'git-server.sh'),
    ],
    join(ROOT, 'git-server.log'),
  );
  writeFileSync(join(ROOT, 'git-server.pid'), String(pid));
  // Seeding is a few commits; the daemon is up once it answers.
  for (let i = 0; i < 100; i += 1) {
    try {
      execFileSync('git', ['ls-remote', 'git://127.0.0.1/acme-labs/xrp-mobile.git'], {
        stdio: 'ignore',
      });
      return;
    } catch {
      execFileSync('sleep', ['0.1']);
    }
  }
  throw new Error(
    `the git server did not come up:\n${readFileSync(join(ROOT, 'git-server.log'), 'utf8')}`,
  );
}

export function startLocalHost(name: string, token: string): FleetHost {
  let record: Omit<LocalRecord, 'supervisor'>;
  if (isRoot) {
    // Account names are 32 characters at most; the host's name is the pairing
    // name, not this.
    const user = `ofh-${name.replace(/[^a-z0-9-]/gi, '').slice(-24)}`.toLowerCase();
    const comment = accountComment(user);
    if (comment !== undefined && comment !== ACCOUNT_MARK) {
      throw new Error(`account ${user} exists and is not a fleet host; refusing to use it`);
    }
    if (comment === undefined) {
      execFileSync('useradd', [
        '--create-home',
        '--shell',
        '/bin/bash',
        '--comment',
        ACCOUNT_MARK,
        user,
      ]);
    }
    record = { name, user, home: `/home/${user}` };
  } else {
    record = { name, user: userInfo().username, home: join(ROOT, 'homes', name) };
  }

  const bin = join(record.home, 'bin');
  mkdirSync(bin, { recursive: true });
  mkdirSync(join(record.home, '.tmux'), { recursive: true, mode: 0o700 });
  for (const file of ['runner', 'claude']) copyFileSync(join(ROOT, 'bin', file), join(bin, file));
  if (isRoot) execFileSync('chown', ['-R', `${record.user}:${record.user}`, record.home]);
  // The runner clones `https://github.com/<owner>/<repo>.git`: here, the local
  // git server, as `git-server` is for a container host.
  runAs(record, [
    'git',
    'config',
    '--global',
    'url.git://127.0.0.1/.insteadOf',
    'https://github.com/',
  ]);
  runAs(record, ['git', 'config', '--global', 'user.name', 'Fleet host']);
  runAs(record, ['git', 'config', '--global', 'user.email', 'fleet@oppenheimer.test']);
  runAs(record, ['runner', 'register', '--token', token, '--url', API_URL, '--name', name]);

  // Kept alive the way the container's entrypoint keeps it, standing in for
  // launchd KeepAlive or systemd Restart=always.
  const log = join(ROOT, `${name}.log`);
  const [command, args] = asHost(record, [
    'sh',
    '-c',
    'while true; do runner run || echo "fleet-host: runner exited ($?), restarting"; sleep 1; done',
  ]);
  const supervisor = detached(command, args, log);
  remember({ ...record, supervisor });

  return {
    name,
    // Every local host is this machine: its hostname proves nothing about which
    // host ran a command, and it cannot lose its network alone (no `cutLink`).
    machine: hostname(),
    killRunner: () => {
      execFileSync('pkill', [
        '-KILL',
        '-x',
        'runner',
        ...(isRoot ? ['-u', record.user] : ['-g', String(supervisor)]),
      ]);
    },
    exec: (commandLine) => runAs(record, ['bash', '-lc', commandLine]),
    logs: () => (existsSync(log) ? readFileSync(log, 'utf8') : ''),
  };
}

/**
 * The accounts carrying the fleet's mark. The mark is the ledger: a run that
 * died between `useradd` and recording the host still left an account this
 * finds, so no crash leaves one behind for good.
 */
function markedAccounts(): string[] {
  try {
    return execFileSync('getent', ['passwd'], { encoding: 'utf8' })
      .split('\n')
      .map((line) => line.split(':'))
      .filter((fields) => fields[4] === ACCOUNT_MARK)
      .map((fields) => fields[0]);
  } catch {
    return [];
  }
}

/**
 * Every host this machine runs for the fleet, every marked account, and the
 * git server. Each step is best-effort, so one busy home cannot keep the rest
 * — the git server above all — running.
 */
export function teardownLocalFleet(): void {
  for (const record of records()) {
    try {
      process.kill(-record.supervisor, 'SIGKILL');
    } catch {}
    try {
      runAs(record, ['tmux', '-L', 'oppenheimer', 'kill-server']);
    } catch {}
  }
  if (isRoot) {
    for (const user of markedAccounts()) {
      try {
        execFileSync('pkill', ['-KILL', '-u', user]);
      } catch {}
      try {
        execFileSync('sleep', ['0.5']);
        execFileSync('userdel', ['-r', user], { stdio: 'ignore' });
      } catch {}
    }
  }
  const gitPid = join(ROOT, 'git-server.pid');
  if (existsSync(gitPid)) {
    try {
      process.kill(-Number(readFileSync(gitPid, 'utf8')), 'SIGKILL');
    } catch {}
  }
  rmSync(ROOT, { recursive: true, force: true });
}
