# @oppenheimer/backend-machines — Agent Instructions

One port over three cloud providers' compute APIs, for renting KVM-capable
hosts. A library package: no NestJS, no `@Global` module, no config-selected
driver — the API holds one driver per connected cloud account.

> Read the root [`CLAUDE.md`](../../../CLAUDE.md) and
> [`.agents/rules/backend-packages.md`](../../../.agents/rules/backend-packages.md).
> The contract is `product/versions/mvp/03-control-plane.md` §Cloud hosts.

## Layout

```
src/
├── machine-provider.ts          # the port and its types
├── errors.ts                    # MachineError and the six codes
├── sizes.ts                     # size → shape per provider, the price catalog
├── tags.ts                      # the two tags every machine carries
├── user-data.ts                 # the cloud-config that pairs a fresh machine
├── create-provider.ts           # factory by provider kind
├── live.integration.spec.ts     # the live smoke test, gated by MACHINES_LIVE
├── providers/
│   ├── aws-ec2.provider.ts      # @aws-sdk/client-ec2
│   ├── oci.provider.ts          # oci-core, oci-common, oci-identity
│   └── alibaba-ecs.provider.ts  # @alicloud/ecs20140526
└── index.ts
```

## Conventions

- **The port is named once**, in the control plane note; change the note and
  this package together, never one alone.
- **A driver maps every provider failure** onto `MachineError` through its
  `mapXxxError` function; a bare SDK error must never leave the package.
- **Fail closed.** A verb the provider cannot do is `MACHINE_UNSUPPORTED`, never
  a quiet substitute. `stop('suspend')` on a driver with `suspend: false` is
  the case that decided this.
- **Tests use fake clients** injected through each driver's `clientFactory`;
  no test touches a provider. A new driver method needs a test that asserts
  the request it sends.
- **Prices are a dated catalog** (`PRICE_CATALOG_DATE`); update the date when
  updating a number, and quote `null` for what the catalog does not know.
- **The live test never runs by accident**: `pnpm test` excludes
  `*.integration.spec.ts`, and `test:integration` skips unless
  `MACHINES_LIVE` names a provider. It always destroys what it made.
- Ships **CommonJS**.

## Commands

```bash
pnpm --filter @oppenheimer/backend-machines build
pnpm --filter @oppenheimer/backend-machines test
```
