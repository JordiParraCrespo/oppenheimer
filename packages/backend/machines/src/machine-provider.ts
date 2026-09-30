/**
 * The port: one interface to create, start, stop, destroy and list
 * KVM-capable hosts on a cloud provider. A driver knows nothing about
 * sessions; it creates machines, says what it can do, and maps its
 * provider's failures onto one small catalog (`errors.ts`).
 *
 * The contract is `product/versions/mvp/03-control-plane.md` §Cloud hosts,
 * and the provider facts behind each rule are `product/14` and `product/15`.
 */

export type ProviderKind = 'aws' | 'oci' | 'alibaba';

/** Sizes resolve to a provider shape per region at create time (`sizes.ts`). */
export type MachineSize = 'small' | 'medium' | 'large';

export type MachineArch = 'arm64' | 'amd64';

export type MachineMarket = 'on-demand' | 'spot';

/** How a host exposes `/dev/kvm`, if at all. */
export type KvmSupport = 'nested' | 'metal' | 'none';

export type MachineImage =
  /** The provider's own Ubuntu 24.04, resolved to the newest id at create time. */
  | { kind: 'ubuntu-24.04' }
  /** A prebaked image the caller already has in that region. */
  | { kind: 'id'; id: string };

/**
 * The per-region network a machine attaches to, created once per cloud
 * account by `ensureNetwork` and stored by the caller. The ids are the
 * provider's; the driver reads only its own.
 */
export interface NetworkRef {
  kind: ProviderKind;
  region: string;
  ids: Record<string, string>;
}

export interface MachineSpec {
  region: string;
  size: MachineSize;
  /**
   * The host must expose `/dev/kvm` (nested virtualisation or bare metal),
   * which is what a microVM session host needs. Drivers that cannot sell it
   * in the region refuse with `MACHINE_UNSUPPORTED`.
   */
  kvm: boolean;
  /** Defaults per provider: Arm where sold and allowed, else x86. */
  arch?: MachineArch;
  image?: MachineImage;
  /** Root disk in GiB. Default 40; Oracle's floor is 50. */
  diskGiB?: number;
  market?: MachineMarket;
  /** cloud-config text; the driver base64-encodes it. */
  userData: string;
  /** Free-form tags beside the two every machine carries (`tags.ts`). */
  tags?: Record<string, string>;
  network: NetworkRef;
}

export interface MachineRef {
  kind: ProviderKind;
  region: string;
  /** The provider's instance id. */
  id: string;
}

export type MachineState =
  | 'pending'
  | 'running'
  | 'stopping'
  | 'stopped'
  | 'suspended'
  | 'terminated'
  | 'unknown';

export interface MachineStatus {
  ref: MachineRef;
  state: MachineState;
  publicIp?: string;
  privateIp?: string;
  launchedAt?: Date;
  tags: Record<string, string>;
}

export interface ProviderCapabilities {
  /** A stop can keep memory (EC2 hibernation). */
  suspend: boolean;
  /** A stopped machine still bills its compute (Hetzner Cloud style). */
  stopBillsCompute: boolean;
  /** A stopped machine may fail to start again (Alibaba economical mode, Oracle capacity). */
  stopMayNotRestart: boolean;
  /** A spot machine survives a stop. */
  spotSurvivesStop: boolean;
  userDataMutable: 'never' | 'when-stopped';
  kvm: KvmSupport;
  /** Regions where Arm shapes are sold, or 'all' / 'none'. */
  arm64Regions: string[] | 'all' | 'none';
}

export interface MachineQuote {
  perHour: number;
  currency: 'USD';
  shape: string;
  /** Where the number comes from; the catalog carries its date. */
  source: 'catalog';
  asOf: string;
}

export interface TagFilter {
  key: string;
  value: string;
}

export interface MachineProvider {
  readonly kind: ProviderKind;

  capabilities(): ProviderCapabilities;

  /**
   * The per-region network, found by tag or created: a VPC or VCN, one
   * subnet, and a security group with no inbound rule. Idempotent.
   */
  ensureNetwork(region: string): Promise<NetworkRef>;

  /**
   * Returns the provider's reference as soon as the provider has the
   * request. The key is sent as the provider's client token; a key is never
   * retried by the caller, which destroys a machine that did not pair and
   * creates a new row with a new key.
   */
  create(spec: MachineSpec, idempotencyKey: string): Promise<MachineRef>;

  start(ref: MachineRef): Promise<void>;

  /**
   * `suspend` keeps memory. A driver whose capabilities say `suspend: false`
   * refuses it with `MACHINE_UNSUPPORTED` rather than degrading to `stop`:
   * the caller reads the capability and sends the verb it means.
   */
  stop(ref: MachineRef, mode: 'stop' | 'suspend'): Promise<void>;

  /** Idempotent and final; boot volumes go with the machine. */
  destroy(ref: MachineRef): Promise<void>;

  describe(ref: MachineRef): Promise<MachineStatus>;

  /** Every instance carrying the tag: the sweeper's view. */
  list(region: string, tag: TagFilter): Promise<MachineStatus[]>;

  /** A per-hour price for the host chip, or null when the catalog has none. */
  quote(spec: MachineSpec): Promise<MachineQuote | null>;

  /**
   * The machine's serial console, decoded, or an empty string while the
   * provider has none yet. The one way to read a machine that has no inbound
   * port: the boot trace, and the smoke test's proof that `/dev/kvm` exists.
   */
  consoleOutput(ref: MachineRef): Promise<string>;
}
