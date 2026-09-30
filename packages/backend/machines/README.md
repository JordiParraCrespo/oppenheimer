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
  `destroy`, `describe`, `list`, `quote`, `consoleOutput`, `capabilities`.
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
pnpm build             # tsc -> dist
pnpm test              # vitest, drivers run against fake clients
pnpm test:integration  # the live smoke test; skipped unless MACHINES_LIVE names a provider
```

## Testing against a real account

`pnpm test` proves the requests we build are the ones we mean, against
fakes. `src/live.integration.spec.ts` proves them against a provider: on one
small machine it runs `ensureNetwork`, `create`, waits for `running`, `list`,
reads the serial console for the line the cloud-config printed
(`oppenheimer-smoke kvm=yes cpus=N`, which is how a machine with no inbound
port proves `/dev/kvm` exists), `stop`, `start`, and always `destroy`. A few
cents per run. It is skipped unless `MACHINES_LIVE` names a provider:

| `MACHINES_LIVE` | Credentials in the environment | Default region |
|---|---|---|
| `aws` | the SDK's default chain: `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY`, a profile, or `AWS_WEB_IDENTITY_TOKEN_FILE` + `AWS_ROLE_ARN` (OIDC) | `eu-central-1` |
| `oci` | `OCI_TENANCY_ID`, `OCI_USER_ID`, `OCI_FINGERPRINT`, `OCI_PRIVATE_KEY` (PEM) or `OCI_PRIVATE_KEY_B64`, `OCI_COMPARTMENT_ID` | `eu-frankfurt-1` |
| `alibaba` | `ALIBABA_CLOUD_ACCESS_KEY_ID`, `ALIBABA_CLOUD_ACCESS_KEY_SECRET` | `eu-central-1` |

`MACHINES_LIVE_REGION` overrides the region. Locally:

```bash
MACHINES_LIVE=aws pnpm --filter @oppenheimer/backend-machines test:integration
```

On GitHub, the manual workflow **Machines live smoke**
(`.github/workflows/machines-live.yml`) runs the same test from
`workflow_dispatch` with the provider as an input. AWS uses OIDC: the
workflow fetches its own identity token and the SDK assumes the role in
`MACHINES_LIVE_AWS_ROLE_ARN`, so no long-lived AWS key exists anywhere.
Oracle and Alibaba keys are repository secrets with the names above.

Setting up the AWS role, once:

1. Add GitHub as an OIDC identity provider in IAM
   (`token.actions.githubusercontent.com`, audience `sts.amazonaws.com`).
2. Create a role whose trust policy allows `sts:AssumeRoleWithWebIdentity`
   for that provider with `sub` limited to
   `repo:<owner>/<repo>:*` (or a branch), and store its ARN in the
   `MACHINES_LIVE_AWS_ROLE_ARN` secret.
3. Give the role the driver's permissions, tag-scoped as
   `product/14 §6` describes: `ec2:RunInstances` on `instance/*` and
   `volume/*` only with `aws:RequestTag/oppenheimer:managed=true`;
   `ec2:CreateTags` only with `ec2:CreateAction=RunInstances`;
   `ec2:StartInstances`, `StopInstances`, `TerminateInstances`,
   `GetConsoleOutput` only with `ec2:ResourceTag/oppenheimer:managed=true`;
   `ec2:Describe*`; and for `ensureNetwork`, `CreateVpc`, `ModifyVpcAttribute`,
   `CreateSubnet`, `CreateInternetGateway`, `AttachInternetGateway`,
   `CreateRoute`, `CreateSecurityGroup`.

What the first real run will tell you that the fakes cannot: whether the
account's vCPU quota admits an `m8i.xlarge` (a new AWS account has 5), whether
nested virtualisation is offered in the region, and how long each provider
takes to reach `running` and to show the console line.

## Consumed by

`apps/api` (`hosts/`, v0.2).
