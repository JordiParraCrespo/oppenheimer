# @oppenheimer/backend-machines

One interface to create, start, stop, destroy and list **KVM-capable hosts**
on AWS EC2, Oracle Cloud Infrastructure and Alibaba Cloud ECS, for the control
plane's `hosts/` module. A driver knows nothing about sessions: it makes
machines, says what it can do, and maps its provider's failures onto one small
error catalog. The contract is
[`product/versions/mvp/03-control-plane.md`](../../../product/versions/mvp/03-control-plane.md)
§Cloud hosts; the provider facts behind each rule are
[`product/14`](../../../product/14-ephemeral-cloud-machines.md) and
[`product/15`](../../../product/15-sessions-in-microvms.md).

## What's inside

- `MachineProvider` — the port: `ensureNetwork`, `create`, `start`, `stop`,
  `destroy`, `describe`, `list`, `quote`, `capabilities`.
- `AwsEc2Provider`, `OciProvider`, `AlibabaEcsProvider` — one driver per
  provider over its official SDK (`@aws-sdk/client-ec2`, `oci-core`,
  `@alicloud/ecs20140526`).
- `createMachineProvider(config)` — one driver per connected cloud account.
- `MachineError` — `MACHINE_CAPACITY` (the only retryable one),
  `MACHINE_QUOTA`, `MACHINE_CREDENTIALS`, `MACHINE_UNSUPPORTED`,
  `MACHINE_NOT_FOUND`, `MACHINE_PROVIDER`.
- `resolveShape`, `catalogPrice` — the size catalog (`small` / `medium` /
  `large`) resolved to a provider shape per region, and list prices checked on
  the date in `PRICE_CATALOG_DATE`.
- `runnerCloudConfig` — the cloud-config that turns a fresh machine into a
  paired host: creates the user, installs what the runner needs, enables the
  user's lingering systemd manager, then runs the ordinary installer with a
  one-hour pairing token.

## Usage

```ts
import { createMachineProvider, runnerCloudConfig } from '@oppenheimer/backend-machines';

const aws = createMachineProvider({
  kind: 'aws',
  credentials: { accessKeyId, secretAccessKey },
});

const network = await aws.ensureNetwork('eu-central-1'); // once per account and region; store the ids

const ref = await aws.create(
  {
    region: 'eu-central-1',
    size: 'medium', // m8i.2xlarge with nested virtualisation
    kvm: true,
    network,
    userData: runnerCloudConfig({ controlPlaneUrl, pairingToken, installScriptUrl, hostName: 'aws eu-central-1' }),
  },
  machineRowId, // the provider's client token; never retried
);

await aws.stop(ref, 'stop'); // 'suspend' is refused by a driver whose capabilities say suspend: false
await aws.start(ref);
await aws.destroy(ref);
```

Rules every driver keeps, so the three cannot drift:

- **`create` is idempotent on the key** (AWS and Alibaba `ClientToken`, Oracle
  `opcRetryToken`) and returns as soon as the provider has the request; the
  caller waits on `describe`.
- **`stop('suspend')` fails closed** on a driver without suspend
  (`MACHINE_UNSUPPORTED`) rather than degrading to a stop.
- **`destroy` is idempotent and final**; boot volumes go with the machine.
- **Every machine and its disks carry two tags**, `oppenheimer:managed=true`
  and `oppenheimer:machine=<key>`; IAM is scoped to the first and the sweeper
  lists by either.
- **`ensureNetwork` never opens an inbound rule**: the runner dials out and
  nothing on the machine listens.
- **`kvm: true`** asks for a host that exposes `/dev/kvm`: Intel instances
  with nested virtualisation on AWS, E5.Flex on Oracle, refused on Alibaba
  (bare metal only).

## Credentials

| Provider | `credentials` | Notes |
|---|---|---|
| `aws` | `{ accessKeyId, secretAccessKey, sessionToken? }`, or omitted for the SDK's default chain | tag-scoped IAM policy; the cross-account role with an ExternalId is the next step |
| `oci` | `{ tenancyId, userId, fingerprint, privateKey, passphrase?, compartmentId }` | an API signing key for a user in its own group, scoped to one compartment |
| `alibaba` | `{ accessKeyId, accessKeySecret, securityToken?, roleArn? }` | a RAM user's key, optionally assuming a role that carries the tag-scoped policy |

## Scripts

```bash
pnpm build   # tsc -> dist
pnpm test    # vitest, drivers run against fake clients
```

## Consumed by

`apps/api` (`hosts/`, v0.2).
