import * as common from 'oci-common';
import * as core from 'oci-core';
import * as identity from 'oci-identity';
import { MachineError, unsupported } from '../errors';
import type {
  MachineProvider,
  MachineQuote,
  MachineRef,
  MachineSpec,
  MachineState,
  MachineStatus,
  NetworkRef,
  ProviderCapabilities,
  TagFilter,
} from '../machine-provider';
import { catalogPrice, PRICE_CATALOG_DATE, resolveShape } from '../sizes';
import { MANAGED_TAG, machineTags, NETWORK_TAG } from '../tags';

/**
 * The slice of the OCI SDK the driver uses, so tests can pass fakes and the
 * factory can pass the real clients. Method parameter types are the SDK's
 * own request shapes, narrowed to the fields the driver sends.
 */
export interface OciClients {
  compute: Pick<
    core.ComputeClient,
    | 'launchInstance'
    | 'instanceAction'
    | 'terminateInstance'
    | 'getInstance'
    | 'listInstances'
    | 'listImages'
  >;
  network: Pick<
    core.VirtualNetworkClient,
    | 'listVcns'
    | 'createVcn'
    | 'listSubnets'
    | 'createSubnet'
    | 'listNatGateways'
    | 'createNatGateway'
    | 'updateRouteTable'
    | 'listNetworkSecurityGroups'
    | 'createNetworkSecurityGroup'
  >;
  identity: Pick<identity.IdentityClient, 'listAvailabilityDomains'>;
}

export interface OciCredentials {
  tenancyId: string;
  userId: string;
  fingerprint: string;
  /** PEM. */
  privateKey: string;
  passphrase?: string;
  /** The compartment every machine and network lives in; the IAM scope. */
  compartmentId: string;
}

export interface OciProviderOptions {
  credentials: OciCredentials;
  /** Injected by tests; otherwise real clients per region. */
  clientFactory?: (region: string) => OciClients;
  vcnCidr?: string;
  subnetCidr?: string;
}

const DEFAULT_DISK_GIB = 50;

const STATES: Record<string, MachineState> = {
  PROVISIONING: 'pending',
  STARTING: 'pending',
  MOVING: 'pending',
  RUNNING: 'running',
  STOPPING: 'stopping',
  STOPPED: 'stopped',
  CREATING_IMAGE: 'running',
  TERMINATING: 'terminated',
  TERMINATED: 'terminated',
};

/**
 * Oracle Cloud Infrastructure. KVM hosts are E5.Flex (AMD) or Standard3.Flex
 * (Intel) shapes, which expose nested virtualisation without a flag; Ampere
 * A1 does not. A stopped Standard or Flex machine bills its boot volume only,
 * and an OS shutdown does not stop billing, so stop is always the API's. There
 * is no suspend. A stopped A1 machine may not find capacity when started
 * again (product/14 §4, product/15 §5).
 */
export class OciProvider implements MachineProvider {
  readonly kind = 'oci' as const;
  private readonly clients = new Map<string, OciClients>();

  constructor(private readonly options: OciProviderOptions) {}

  capabilities(): ProviderCapabilities {
    return {
      suspend: false,
      stopBillsCompute: false,
      stopMayNotRestart: true,
      spotSurvivesStop: false,
      userDataMutable: 'never',
      kvm: 'nested',
      arm64Regions: 'all',
    };
  }

  async ensureNetwork(region: string): Promise<NetworkRef> {
    const { network, identity } = this.client(region);
    const compartmentId = this.options.credentials.compartmentId;
    const freeformTags = {
      [NETWORK_TAG.key]: NETWORK_TAG.value,
      [MANAGED_TAG.key]: MANAGED_TAG.value,
    };

    const vcns = await this.call(() =>
      network.listVcns({ compartmentId, lifecycleState: 'AVAILABLE' }),
    );
    let vcn = vcns.items.find((item) => item.freeformTags?.[NETWORK_TAG.key] === NETWORK_TAG.value);
    if (!vcn) {
      const created = await this.call(() =>
        network.createVcn({
          createVcnDetails: {
            compartmentId,
            cidrBlock: this.options.vcnCidr ?? '10.42.0.0/16',
            displayName: 'oppenheimer',
            dnsLabel: 'oppenheimer',
            freeformTags,
          },
        }),
      );
      vcn = created.vcn;
      // Egress only: a NAT gateway, and the default route table sends everything to it.
      const nat = await this.call(() =>
        network.createNatGateway({
          createNatGatewayDetails: {
            compartmentId,
            vcnId: vcn?.id as string,
            displayName: 'oppenheimer-nat',
            freeformTags,
          },
        }),
      );
      await this.call(() =>
        network.updateRouteTable({
          rtId: vcn?.defaultRouteTableId as string,
          updateRouteTableDetails: {
            routeRules: [
              {
                destination: '0.0.0.0/0',
                destinationType: core.models.RouteRule.DestinationType.CidrBlock,
                networkEntityId: nat.natGateway.id,
              },
            ],
          },
        }),
      );
    }
    const vcnId = vcn.id;

    const subnets = await this.call(() =>
      network.listSubnets({ compartmentId, vcnId, lifecycleState: 'AVAILABLE' }),
    );
    let subnet = subnets.items.find(
      (item) => item.freeformTags?.[NETWORK_TAG.key] === NETWORK_TAG.value,
    );
    if (!subnet) {
      const created = await this.call(() =>
        network.createSubnet({
          createSubnetDetails: {
            compartmentId,
            vcnId,
            cidrBlock: this.options.subnetCidr ?? '10.42.0.0/20',
            displayName: 'oppenheimer-private',
            prohibitPublicIpOnVnic: true,
            prohibitInternetIngress: true,
            routeTableId: vcn.defaultRouteTableId,
            freeformTags,
          },
        }),
      );
      subnet = created.subnet;
    }

    const groups = await this.call(() =>
      network.listNetworkSecurityGroups({ compartmentId, vcnId, lifecycleState: 'AVAILABLE' }),
    );
    let nsg = groups.items.find(
      (item) => item.freeformTags?.[NETWORK_TAG.key] === NETWORK_TAG.value,
    );
    if (!nsg) {
      // No ingress rule is ever added: the runner dials out, nothing listens.
      const created = await this.call(() =>
        network.createNetworkSecurityGroup({
          createNetworkSecurityGroupDetails: {
            compartmentId,
            vcnId,
            displayName: 'oppenheimer-egress-only',
            freeformTags,
          },
        }),
      );
      nsg = created.networkSecurityGroup;
    }

    const domains = await this.call(() => identity.listAvailabilityDomains({ compartmentId }));
    const availabilityDomain = domains.items[0]?.name;
    if (!availabilityDomain)
      throw new MachineError('MACHINE_PROVIDER', `no availability domain in ${region}`);

    return {
      kind: 'oci',
      region,
      ids: { compartmentId, vcnId, subnetId: subnet.id, nsgId: nsg.id, availabilityDomain },
    };
  }

  async create(spec: MachineSpec, idempotencyKey: string): Promise<MachineRef> {
    const shape = resolveShape('oci', spec);
    const { compute } = this.client(spec.region);
    const compartmentId = this.options.credentials.compartmentId;
    const imageId = await this.resolveImage(spec, shape.name);
    const bootVolumeSizeInGBs = Math.max(spec.diskGiB ?? DEFAULT_DISK_GIB, DEFAULT_DISK_GIB);

    const result = await this.call(() =>
      compute.launchInstance({
        opcRetryToken: idempotencyKey,
        launchInstanceDetails: {
          compartmentId,
          availabilityDomain: spec.network.ids.availabilityDomain,
          displayName: `oppenheimer-${idempotencyKey}`,
          shape: shape.name,
          shapeConfig: { ocpus: shape.ocpus, memoryInGBs: shape.memoryGiB },
          sourceDetails: { sourceType: 'image', imageId, bootVolumeSizeInGBs },
          createVnicDetails: {
            subnetId: spec.network.ids.subnetId,
            assignPublicIp: false,
            nsgIds: [spec.network.ids.nsgId],
          },
          metadata: { user_data: Buffer.from(spec.userData, 'utf8').toString('base64') },
          freeformTags: machineTags(idempotencyKey, spec.tags),
          ...(spec.market === 'spot'
            ? {
                preemptibleInstanceConfig: {
                  preemptionAction: { type: 'TERMINATE', preserveBootVolume: false },
                },
              }
            : {}),
        },
      }),
    );
    return { kind: 'oci', region: spec.region, id: result.instance.id };
  }

  async start(ref: MachineRef): Promise<void> {
    await this.call(() =>
      this.client(ref.region).compute.instanceAction({ instanceId: ref.id, action: 'START' }),
    );
  }

  async stop(ref: MachineRef, mode: 'stop' | 'suspend'): Promise<void> {
    if (mode === 'suspend') {
      throw unsupported('Oracle Cloud has no suspend; send stop');
    }
    // SOFTSTOP asks the guest to shut down and hard-stops after fifteen minutes.
    await this.call(() =>
      this.client(ref.region).compute.instanceAction({ instanceId: ref.id, action: 'SOFTSTOP' }),
    );
  }

  async destroy(ref: MachineRef): Promise<void> {
    try {
      await this.call(() =>
        this.client(ref.region).compute.terminateInstance({
          instanceId: ref.id,
          preserveBootVolume: false,
        }),
      );
    } catch (error) {
      if (error instanceof MachineError && error.code === 'MACHINE_NOT_FOUND') return;
      throw error;
    }
  }

  async describe(ref: MachineRef): Promise<MachineStatus> {
    const result = await this.call(() =>
      this.client(ref.region).compute.getInstance({ instanceId: ref.id }),
    );
    return this.toStatus(ref.region, result.instance);
  }

  async list(region: string, tag: TagFilter): Promise<MachineStatus[]> {
    const { compute } = this.client(region);
    const compartmentId = this.options.credentials.compartmentId;
    const statuses: MachineStatus[] = [];
    let page: string | undefined;
    do {
      const result = await this.call(() =>
        compute.listInstances({ compartmentId, page, limit: 100 }),
      );
      for (const instance of result.items) {
        if (instance.freeformTags?.[tag.key] !== tag.value) continue;
        const status = this.toStatus(region, instance);
        if (status.state !== 'terminated') statuses.push(status);
      }
      page = result.opcNextPage;
    } while (page);
    return statuses;
  }

  async quote(spec: MachineSpec): Promise<MachineQuote | null> {
    const shape = resolveShape('oci', spec);
    const perHour = catalogPrice('oci', shape, spec.region);
    return perHour === null
      ? null
      : {
          perHour,
          currency: 'USD',
          shape: `${shape.name} ${shape.ocpus} OCPU / ${shape.memoryGiB} GB`,
          source: 'catalog',
          asOf: PRICE_CATALOG_DATE,
        };
  }

  private async resolveImage(spec: MachineSpec, shapeName: string): Promise<string> {
    if (spec.image?.kind === 'id') return spec.image.id;
    const { compute } = this.client(spec.region);
    const images = await this.call(() =>
      compute.listImages({
        compartmentId: this.options.credentials.compartmentId,
        operatingSystem: 'Canonical Ubuntu',
        operatingSystemVersion: '24.04',
        shape: shapeName,
        sortBy: core.requests.ListImagesRequest.SortBy.Timecreated,
        sortOrder: core.requests.ListImagesRequest.SortOrder.Desc,
      }),
    );
    const image = images.items[0];
    if (!image)
      throw new MachineError(
        'MACHINE_PROVIDER',
        `no Ubuntu 24.04 image for ${shapeName} in ${spec.region}`,
      );
    return image.id;
  }

  private toStatus(
    region: string,
    instance: {
      id: string;
      lifecycleState: string;
      timeCreated?: Date;
      freeformTags?: { [key: string]: string };
    },
  ): MachineStatus {
    return {
      ref: { kind: 'oci', region, id: instance.id },
      state: STATES[instance.lifecycleState] ?? 'unknown',
      launchedAt: instance.timeCreated,
      tags: { ...instance.freeformTags },
    };
  }

  private client(region: string): OciClients {
    let clients = this.clients.get(region);
    if (!clients) {
      clients = this.options.clientFactory
        ? this.options.clientFactory(region)
        : this.realClients(region);
      this.clients.set(region, clients);
    }
    return clients;
  }

  private realClients(region: string): OciClients {
    const c = this.options.credentials;
    const provider = new common.SimpleAuthenticationDetailsProvider(
      c.tenancyId,
      c.userId,
      c.fingerprint,
      c.privateKey,
      c.passphrase ?? null,
      common.Region.fromRegionId(region),
    );
    const compute = new core.ComputeClient({ authenticationDetailsProvider: provider });
    const network = new core.VirtualNetworkClient({ authenticationDetailsProvider: provider });
    const identityClient = new identity.IdentityClient({ authenticationDetailsProvider: provider });
    compute.regionId = region;
    network.regionId = region;
    identityClient.regionId = region;
    return { compute, network, identity: identityClient };
  }

  private async call<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      throw mapOciError(error);
    }
  }
}

export function mapOciError(error: unknown): MachineError {
  if (error instanceof MachineError) return error;
  const err = error as { statusCode?: number; serviceCode?: string; message?: string };
  const code = err.serviceCode ?? '';
  const detail = err.message ?? String(error);
  const options = { providerCode: code || undefined, cause: error };
  if (/out of host capacity|out of capacity/i.test(detail))
    return new MachineError('MACHINE_CAPACITY', detail, options);
  if (code === 'LimitExceeded' || code === 'QuotaExceeded' || code === 'TooManyRequests') {
    return new MachineError('MACHINE_QUOTA', detail, options);
  }
  if (err.statusCode === 401 || code === 'NotAuthenticated')
    return new MachineError('MACHINE_CREDENTIALS', detail, options);
  if (err.statusCode === 404 || code === 'NotAuthorizedOrNotFound')
    return new MachineError('MACHINE_NOT_FOUND', detail, options);
  return new MachineError('MACHINE_PROVIDER', detail, options);
}
