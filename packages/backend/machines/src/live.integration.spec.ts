import { describe, expect, it } from 'vitest';
import { createMachineProvider } from './create-provider';
import { MachineError } from './errors';
import type { MachineProvider, MachineRef, MachineSpec, MachineState } from './machine-provider';
import { MACHINE_TAG_KEY } from './tags';

/**
 * The live smoke test: every verb of the port against a real account, on
 * one small machine, with the serial console as the proof that `/dev/kvm`
 * exists on a host we asked for as a KVM host. It costs a few cents and runs
 * only when `MACHINES_LIVE` names a provider; `pnpm test` never reaches it.
 *
 *   MACHINES_LIVE=aws      credentials from the SDK's default chain (keys, a
 *                          profile, or OIDC through AWS_WEB_IDENTITY_TOKEN_FILE)
 *   MACHINES_LIVE=oci      OCI_TENANCY_ID, OCI_USER_ID, OCI_FINGERPRINT,
 *                          OCI_PRIVATE_KEY (PEM) or OCI_PRIVATE_KEY_B64, OCI_COMPARTMENT_ID
 *   MACHINES_LIVE=alibaba  ALIBABA_CLOUD_ACCESS_KEY_ID, ALIBABA_CLOUD_ACCESS_KEY_SECRET
 *   MACHINES_LIVE_REGION   optional; defaults below
 *
 * Whatever happens, the `finally` destroys the machine. The network the test
 * creates on first run stays, tagged, for the next run.
 */
const PROVIDER = process.env.MACHINES_LIVE as 'aws' | 'oci' | 'alibaba' | undefined;

const DEFAULT_REGION = {
  aws: 'eu-central-1',
  oci: 'eu-frankfurt-1',
  alibaba: 'eu-central-1',
} as const;
const MARKER = 'oppenheimer-smoke';
const MINUTE = 60_000;

const smokeCloudConfig = [
  '#cloud-config',
  'runcmd:',
  `  - [sh, -c, "printf '${MARKER} kvm=%s cpus=%s\\\\n' \\"$([ -c /dev/kvm ] && echo yes || echo no)\\" \\"$(nproc)\\" | tee /dev/console"]`,
  '',
].join('\n');

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required for MACHINES_LIVE=${PROVIDER}`);
  return value;
}

function providerFromEnv(): MachineProvider {
  switch (PROVIDER) {
    case 'aws':
      return createMachineProvider({ kind: 'aws' });
    case 'oci':
      return createMachineProvider({
        kind: 'oci',
        credentials: {
          tenancyId: env('OCI_TENANCY_ID'),
          userId: env('OCI_USER_ID'),
          fingerprint: env('OCI_FINGERPRINT'),
          privateKey:
            process.env.OCI_PRIVATE_KEY ??
            Buffer.from(env('OCI_PRIVATE_KEY_B64'), 'base64').toString('utf8'),
          passphrase: process.env.OCI_PRIVATE_KEY_PASSPHRASE,
          compartmentId: env('OCI_COMPARTMENT_ID'),
        },
      });
    case 'alibaba':
      return createMachineProvider({
        kind: 'alibaba',
        credentials: {
          accessKeyId: env('ALIBABA_CLOUD_ACCESS_KEY_ID'),
          accessKeySecret: env('ALIBABA_CLOUD_ACCESS_KEY_SECRET'),
          securityToken: process.env.ALIBABA_CLOUD_SECURITY_TOKEN,
        },
      });
    default:
      throw new Error(`unknown MACHINES_LIVE ${PROVIDER}`);
  }
}

async function waitForState(
  provider: MachineProvider,
  ref: MachineRef,
  wanted: MachineState[],
  timeoutMs: number,
) {
  const deadline = Date.now() + timeoutMs;
  let last: MachineState = 'unknown';
  while (Date.now() < deadline) {
    try {
      last = (await provider.describe(ref)).state;
    } catch (error) {
      if (
        error instanceof MachineError &&
        error.code === 'MACHINE_NOT_FOUND' &&
        wanted.includes('terminated')
      ) {
        return 'terminated';
      }
      throw error;
    }
    if (wanted.includes(last)) return last;
    await new Promise((resolve) => setTimeout(resolve, 10_000));
  }
  throw new Error(
    `${ref.id} is ${last}, wanted ${wanted.join(' or ')} within ${timeoutMs / MINUTE} min`,
  );
}

async function waitForConsoleMarker(provider: MachineProvider, ref: MachineRef, timeoutMs: number) {
  const deadline = Date.now() + timeoutMs;
  let output = '';
  while (Date.now() < deadline) {
    output = await provider.consoleOutput(ref);
    const line = output.split('\n').find((l) => l.includes(MARKER));
    if (line) return line;
    await new Promise((resolve) => setTimeout(resolve, 20_000));
  }
  throw new Error(
    `no "${MARKER}" line on the console within ${timeoutMs / MINUTE} min; last output:\n${output.slice(-2000)}`,
  );
}

describe.skipIf(!PROVIDER)(`live smoke on ${PROVIDER}`, () => {
  it(
    'creates a host, proves KVM on the console, stops, starts, destroys',
    async () => {
      const provider = providerFromEnv();
      const kind = PROVIDER as 'aws' | 'oci' | 'alibaba';
      const region = process.env.MACHINES_LIVE_REGION ?? DEFAULT_REGION[kind];
      const key = `smoke-${Date.now().toString(36)}`;
      const wantsKvm = provider.capabilities().kvm !== 'none';
      let ref: MachineRef | undefined;

      try {
        const network = await provider.ensureNetwork(region);
        expect(network.kind).toBe(kind);

        const spec: MachineSpec = {
          region,
          size: 'small',
          kvm: wantsKvm,
          userData: smokeCloudConfig,
          network,
        };
        const quote = await provider.quote(spec);
        console.log(
          `[${kind}] ${quote ? `${quote.shape} at $${quote.perHour}/h` : 'no catalog price'}`,
        );

        ref = await provider.create(spec, key);
        console.log(`[${kind}] created ${ref.id}`);
        expect(await waitForState(provider, ref, ['running'], 10 * MINUTE)).toBe('running');

        const listed = await provider.list(region, { key: MACHINE_TAG_KEY, value: key });
        expect(listed.map((m) => m.ref.id)).toContain(ref.id);

        const line = await waitForConsoleMarker(provider, ref, 8 * MINUTE);
        console.log(`[${kind}] console: ${line}`);
        expect(line).toContain(wantsKvm ? 'kvm=yes' : 'kvm=');

        await provider.stop(ref, 'stop');
        expect(await waitForState(provider, ref, ['stopped'], 15 * MINUTE)).toBe('stopped');

        await provider.start(ref);
        expect(await waitForState(provider, ref, ['running'], 10 * MINUTE)).toBe('running');
      } finally {
        if (ref) {
          await provider.destroy(ref);
          await waitForState(provider, ref, ['terminated'], 10 * MINUTE);
          const listed = await provider.list(region, { key: MACHINE_TAG_KEY, value: key });
          expect(listed.map((m) => m.ref.id)).not.toContain(ref.id);
          console.log(`[${kind}] destroyed ${ref.id}`);
        }
      }
    },
    60 * MINUTE,
  );
});
