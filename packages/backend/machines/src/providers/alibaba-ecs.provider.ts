import Credential, { Config as CredentialConfig } from '@alicloud/credentials';
import Ecs, * as $Ecs from '@alicloud/ecs20140526';
import { $OpenApiUtil } from '@alicloud/openapi-core';
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
import { ALIBABA_ARM_REGIONS, catalogPrice, PRICE_CATALOG_DATE, resolveShape } from '../sizes';
import { MANAGED_TAG, machineTags, NETWORK_TAG } from '../tags';

/** The slice of the ECS client the driver uses; tests pass a fake. */
export type EcsApi = Pick<
  Ecs,
  | 'runInstances'
  | 'startInstance'
  | 'stopInstance'
  | 'deleteInstance'
  | 'describeInstances'
  | 'describeVpcs'
  | 'createVpc'
  | 'describeVSwitches'
  | 'createVSwitch'
  | 'describeSecurityGroups'
  | 'createSecurityGroup'
  | 'describeZones'
>;

export interface AlibabaCredentials {
  accessKeyId: string;
  accessKeySecret: string;
  securityToken?: string;
  /** Assume this RAM role with the key above instead of acting as the key's user. */
  roleArn?: string;
}

export interface AlibabaEcsProviderOptions {
  credentials: AlibabaCredentials;
  /** Injected by tests; otherwise one ECS client per region. */
  clientFactory?: (region: string) => EcsApi;
  vpcCidr?: string;
  vSwitchCidr?: string;
  /** How long to wait for a new VPC to become Available. */
  vpcReadyTimeoutMs?: number;
  sleep?: (ms: number) => Promise<void>;
}

const DEFAULT_DISK_GIB = 40;
const VPC_NAME = 'oppenheimer';

const STATES: Record<string, MachineState> = {
  Pending: 'pending',
  Starting: 'pending',
  Running: 'running',
  Stopping: 'stopping',
  Stopped: 'stopped',
};

/**
 * Alibaba Cloud ECS. Ordinary instances do not expose KVM (the API carries a
 * `CpuOptions.NestedVirtualization` field, undocumented for VM families and
 * unverified; bare metal is the documented path at 104 vCPU and up), so `kvm`
 * is refused. A stopped machine in economical mode bills its disks only, the
 * system public IP is released, and the instance may not start again when the
 * zone has no inventory (product/14 §4).
 */
export class AlibabaEcsProvider implements MachineProvider {
  readonly kind = 'alibaba' as const;
  private readonly clients = new Map<string, EcsApi>();

  constructor(private readonly options: AlibabaEcsProviderOptions) {}

  capabilities(): ProviderCapabilities {
    return {
      suspend: false,
      stopBillsCompute: false,
      stopMayNotRestart: true,
      spotSurvivesStop: false,
      userDataMutable: 'when-stopped',
      kvm: 'none',
      arm64Regions: ALIBABA_ARM_REGIONS,
    };
  }

  async ensureNetwork(region: string): Promise<NetworkRef> {
    const ecs = this.client(region);
    const networkTags = [
      { key: NETWORK_TAG.key, value: NETWORK_TAG.value },
      { key: MANAGED_TAG.key, value: MANAGED_TAG.value },
    ];

    const vpcs = await this.call(() =>
      ecs.describeVpcs(new $Ecs.DescribeVpcsRequest({ regionId: region, pageSize: 50 })),
    );
    let vpcId = vpcs.body?.vpcs?.vpc?.find((vpc) => vpc.vpcName === VPC_NAME)?.vpcId;
    if (!vpcId) {
      const created = await this.call(() =>
        ecs.createVpc(
          new $Ecs.CreateVpcRequest({
            regionId: region,
            cidrBlock: this.options.vpcCidr ?? '10.42.0.0/16',
            vpcName: VPC_NAME,
            description: 'Oppenheimer machines',
          }),
        ),
      );
      vpcId = created.body?.vpcId;
      if (!vpcId) throw new MachineError('MACHINE_PROVIDER', 'CreateVpc returned no id');
      await this.waitForVpc(region, vpcId);
    }

    const vSwitches = await this.call(() =>
      ecs.describeVSwitches(
        new $Ecs.DescribeVSwitchesRequest({ regionId: region, vpcId, pageSize: 50 }),
      ),
    );
    let vSwitchId = vSwitches.body?.vSwitches?.vSwitch?.[0]?.vSwitchId;
    let zoneId = vSwitches.body?.vSwitches?.vSwitch?.[0]?.zoneId;
    if (!vSwitchId) {
      const zones = await this.call(() =>
        ecs.describeZones(new $Ecs.DescribeZonesRequest({ regionId: region })),
      );
      zoneId = zones.body?.zones?.zone?.[0]?.zoneId;
      if (!zoneId) throw new MachineError('MACHINE_PROVIDER', `no zone in ${region}`);
      const created = await this.call(() =>
        ecs.createVSwitch(
          new $Ecs.CreateVSwitchRequest({
            regionId: region,
            vpcId,
            zoneId,
            cidrBlock: this.options.vSwitchCidr ?? '10.42.0.0/20',
            vSwitchName: VPC_NAME,
          }),
        ),
      );
      vSwitchId = created.body?.vSwitchId;
      if (!vSwitchId) throw new MachineError('MACHINE_PROVIDER', 'CreateVSwitch returned no id');
    }

    const groups = await this.call(() =>
      ecs.describeSecurityGroups(
        new $Ecs.DescribeSecurityGroupsRequest({
          regionId: region,
          vpcId,
          tag: [
            new $Ecs.DescribeSecurityGroupsRequestTag({
              key: NETWORK_TAG.key,
              value: NETWORK_TAG.value,
            }),
          ],
        }),
      ),
    );
    let securityGroupId = groups.body?.securityGroups?.securityGroup?.[0]?.securityGroupId;
    if (!securityGroupId) {
      // A new security group has no inbound rule and allows all outbound; none is ever added.
      const created = await this.call(() =>
        ecs.createSecurityGroup(
          new $Ecs.CreateSecurityGroupRequest({
            regionId: region,
            vpcId,
            securityGroupName: 'oppenheimer-egress-only',
            description: 'Oppenheimer machines: no inbound, all outbound',
            tag: networkTags.map((t) => new $Ecs.CreateSecurityGroupRequestTag(t)),
          }),
        ),
      );
      securityGroupId = created.body?.securityGroupId;
      if (!securityGroupId)
        throw new MachineError('MACHINE_PROVIDER', 'CreateSecurityGroup returned no id');
    }

    return {
      kind: 'alibaba',
      region,
      ids: { vpcId, vSwitchId, securityGroupId, zoneId: zoneId ?? '' },
    };
  }

  async create(spec: MachineSpec, idempotencyKey: string): Promise<MachineRef> {
    const shape = resolveShape('alibaba', spec);
    const ecs = this.client(spec.region);
    const tags = Object.entries(machineTags(idempotencyKey, spec.tags)).map(
      ([key, value]) => new $Ecs.RunInstancesRequestTag({ key, value }),
    );
    const request = new $Ecs.RunInstancesRequest({
      regionId: spec.region,
      zoneId: spec.network.ids.zoneId || undefined,
      instanceType: shape.name,
      ...(spec.image?.kind === 'id'
        ? { imageId: spec.image.id }
        : {
            imageFamily: shape.arch === 'arm64' ? 'acs:ubuntu_24_04_arm64' : 'acs:ubuntu_24_04_x64',
          }),
      instanceChargeType: 'PostPaid',
      spotStrategy: spec.market === 'spot' ? 'SpotAsPriceGo' : 'NoSpot',
      systemDisk: new $Ecs.RunInstancesRequestSystemDisk({
        category: 'cloud_essd',
        size: String(spec.diskGiB ?? DEFAULT_DISK_GIB),
        performanceLevel: 'PL0',
      }),
      securityGroupId: spec.network.ids.securityGroupId,
      vSwitchId: spec.network.ids.vSwitchId,
      // A system public IP billed by traffic; the security group has no inbound rule.
      internetMaxBandwidthOut: 100,
      internetChargeType: 'PayByTraffic',
      userData: Buffer.from(spec.userData, 'utf8').toString('base64'),
      clientToken: idempotencyKey,
      instanceName: `oppenheimer-${idempotencyKey}`,
      amount: 1,
      tag: tags,
    });
    const result = await this.call(() => ecs.runInstances(request));
    const id = result.body?.instanceIdSets?.instanceIdSet?.[0];
    if (!id) throw new MachineError('MACHINE_PROVIDER', 'RunInstances returned no instance');
    return { kind: 'alibaba', region: spec.region, id };
  }

  async start(ref: MachineRef): Promise<void> {
    await this.call(() =>
      this.client(ref.region).startInstance(new $Ecs.StartInstanceRequest({ instanceId: ref.id })),
    );
  }

  async stop(ref: MachineRef, mode: 'stop' | 'suspend'): Promise<void> {
    if (mode === 'suspend') {
      throw unsupported(
        'Alibaba Cloud hibernation is region-locked and needs an encrypted custom image; send stop',
      );
    }
    await this.call(() =>
      this.client(ref.region).stopInstance(
        new $Ecs.StopInstanceRequest({ instanceId: ref.id, stoppedMode: 'StopCharging' }),
      ),
    );
  }

  async destroy(ref: MachineRef): Promise<void> {
    try {
      await this.call(() =>
        this.client(ref.region).deleteInstance(
          new $Ecs.DeleteInstanceRequest({ instanceId: ref.id, force: true }),
        ),
      );
    } catch (error) {
      if (error instanceof MachineError && error.code === 'MACHINE_NOT_FOUND') return;
      throw error;
    }
  }

  async describe(ref: MachineRef): Promise<MachineStatus> {
    const result = await this.call(() =>
      this.client(ref.region).describeInstances(
        new $Ecs.DescribeInstancesRequest({
          regionId: ref.region,
          instanceIds: JSON.stringify([ref.id]),
        }),
      ),
    );
    const instance = result.body?.instances?.instance?.[0];
    if (!instance) throw new MachineError('MACHINE_NOT_FOUND', ref.id);
    return this.toStatus(ref.region, instance);
  }

  async list(region: string, tag: TagFilter): Promise<MachineStatus[]> {
    const ecs = this.client(region);
    const statuses: MachineStatus[] = [];
    let nextToken: string | undefined;
    do {
      const page = await this.call(() =>
        ecs.describeInstances(
          new $Ecs.DescribeInstancesRequest({
            regionId: region,
            tag: [new $Ecs.DescribeInstancesRequestTag({ key: tag.key, value: tag.value })],
            maxResults: 100,
            nextToken,
          }),
        ),
      );
      for (const instance of page.body?.instances?.instance ?? []) {
        statuses.push(this.toStatus(region, instance));
      }
      nextToken = page.body?.nextToken || undefined;
    } while (nextToken);
    return statuses;
  }

  async quote(spec: MachineSpec): Promise<MachineQuote | null> {
    const shape = resolveShape('alibaba', spec);
    const perHour = catalogPrice('alibaba', shape, spec.region);
    return perHour === null
      ? null
      : {
          perHour,
          currency: 'USD',
          shape: shape.name,
          source: 'catalog',
          asOf: PRICE_CATALOG_DATE,
        };
  }

  private async waitForVpc(region: string, vpcId: string): Promise<void> {
    const ecs = this.client(region);
    const sleep = this.options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
    const deadline = Date.now() + (this.options.vpcReadyTimeoutMs ?? 60_000);
    while (Date.now() < deadline) {
      const described = await this.call(() =>
        ecs.describeVpcs(new $Ecs.DescribeVpcsRequest({ regionId: region, vpcId })),
      );
      if (described.body?.vpcs?.vpc?.[0]?.status === 'Available') return;
      await sleep(2000);
    }
    throw new MachineError('MACHINE_PROVIDER', `VPC ${vpcId} did not become Available in time`);
  }

  private toStatus(
    region: string,
    instance: $Ecs.DescribeInstancesResponseBodyInstancesInstance,
  ): MachineStatus {
    const tags: Record<string, string> = {};
    for (const tag of instance.tags?.tag ?? []) {
      if (tag.tagKey) tags[tag.tagKey] = tag.tagValue ?? '';
    }
    return {
      ref: { kind: 'alibaba', region, id: instance.instanceId ?? '' },
      state: STATES[instance.status ?? ''] ?? 'unknown',
      publicIp: instance.publicIpAddress?.ipAddress?.[0],
      privateIp: instance.vpcAttributes?.privateIpAddress?.ipAddress?.[0],
      launchedAt: instance.creationTime ? new Date(instance.creationTime) : undefined,
      tags,
    };
  }

  private client(region: string): EcsApi {
    let client = this.clients.get(region);
    if (!client) {
      client = this.options.clientFactory
        ? this.options.clientFactory(region)
        : this.realClient(region);
      this.clients.set(region, client);
    }
    return client;
  }

  private realClient(region: string): EcsApi {
    const c = this.options.credentials;
    const credential = new Credential(
      new CredentialConfig(
        c.roleArn
          ? {
              type: 'ram_role_arn',
              accessKeyId: c.accessKeyId,
              accessKeySecret: c.accessKeySecret,
              securityToken: c.securityToken,
              roleArn: c.roleArn,
              roleSessionName: 'oppenheimer',
            }
          : {
              type: c.securityToken ? 'sts' : 'access_key',
              accessKeyId: c.accessKeyId,
              accessKeySecret: c.accessKeySecret,
              securityToken: c.securityToken,
            },
      ),
    );
    return new Ecs(
      new $OpenApiUtil.Config({
        credential,
        endpoint: `ecs.${region}.aliyuncs.com`,
        regionId: region,
      }),
    );
  }

  private async call<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      throw mapAlibabaError(error);
    }
  }
}

export function mapAlibabaError(error: unknown): MachineError {
  if (error instanceof MachineError) return error;
  const err = error as { code?: string; message?: string; statusCode?: number };
  const code = err.code ?? '';
  const detail = err.message ?? String(error);
  const options = { providerCode: code || undefined, cause: error };
  if (/NoStock|NotOnSale|SoldOut|InsufficientResource|OperationDenied\.NoStock/i.test(code)) {
    return new MachineError('MACHINE_CAPACITY', detail, options);
  }
  if (/Quota|LimitExceed|Exceed/i.test(code))
    return new MachineError('MACHINE_QUOTA', detail, options);
  if (
    /InvalidAccessKeyId|SignatureDoesNotMatch|Forbidden|InvalidSecurityToken|NoPermission/i.test(
      code,
    )
  ) {
    return new MachineError('MACHINE_CREDENTIALS', detail, options);
  }
  if (/InvalidInstanceId/i.test(code))
    return new MachineError('MACHINE_NOT_FOUND', detail, options);
  return new MachineError('MACHINE_PROVIDER', detail, options);
}
