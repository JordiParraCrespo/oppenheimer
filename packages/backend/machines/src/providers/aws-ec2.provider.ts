import {
  AttachInternetGatewayCommand,
  CreateInternetGatewayCommand,
  CreateRouteCommand,
  CreateSecurityGroupCommand,
  CreateSubnetCommand,
  CreateVpcCommand,
  DescribeImagesCommand,
  DescribeInstancesCommand,
  DescribeRouteTablesCommand,
  DescribeSecurityGroupsCommand,
  DescribeSubnetsCommand,
  DescribeVpcsCommand,
  EC2Client,
  GetConsoleOutputCommand,
  ModifyVpcAttributeCommand,
  RunInstancesCommand,
  type RunInstancesCommandInput,
  StartInstancesCommand,
  StopInstancesCommand,
  TerminateInstancesCommand,
} from '@aws-sdk/client-ec2';
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

/** What the driver needs of an EC2 client: `send`. Tests pass a fake. */
export interface Ec2Sender {
  // biome-ignore lint/suspicious/noExplicitAny: the SDK's command union is open-ended
  send(command: any): Promise<any>;
}

export interface AwsCredentials {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
}

export interface AwsEc2ProviderOptions {
  /** Static keys; omitted, the SDK's default provider chain applies. */
  credentials?: AwsCredentials;
  /** Injected by tests; otherwise one `EC2Client` per region. */
  clientFactory?: (region: string) => Ec2Sender;
  /** The network the driver creates on `ensureNetwork`. */
  vpcCidr?: string;
  subnetCidr?: string;
}

const CANONICAL_OWNER = '099720109477';
const DEFAULT_DISK_GIB = 40;

const STATES: Record<string, MachineState> = {
  pending: 'pending',
  running: 'running',
  stopping: 'stopping',
  stopped: 'stopped',
  'shutting-down': 'terminated',
  terminated: 'terminated',
};

const CAPACITY = new Set([
  'InsufficientInstanceCapacity',
  'InsufficientCapacity',
  'Unsupported',
  'SpotMaxPriceTooLow',
]);
const QUOTA = new Set([
  'VcpuLimitExceeded',
  'InstanceLimitExceeded',
  'MaxSpotInstanceCountExceeded',
  'PendingVerification',
  'VolumeLimitExceeded',
]);
const CREDENTIALS = new Set([
  'AuthFailure',
  'UnauthorizedOperation',
  'InvalidClientTokenId',
  'SignatureDoesNotMatch',
  'ExpiredToken',
  'RequestExpired',
  'CredentialsProviderError',
]);
const NOT_FOUND = new Set(['InvalidInstanceID.NotFound', 'InvalidInstanceID.Malformed']);

/**
 * AWS EC2. KVM hosts are Intel instances with nested virtualisation enabled
 * at launch (available on ordinary instances since February 2026). Stopped
 * machines bill EBS only. Hibernation exists on AWS but must be configured at
 * launch with an encrypted root and a supported image, which this driver does
 * not do yet, so `suspend` is refused rather than faked (product/15 §6).
 */
export class AwsEc2Provider implements MachineProvider {
  readonly kind = 'aws' as const;
  private readonly clients = new Map<string, Ec2Sender>();

  constructor(private readonly options: AwsEc2ProviderOptions = {}) {}

  capabilities(): ProviderCapabilities {
    return {
      suspend: false,
      stopBillsCompute: false,
      stopMayNotRestart: false,
      spotSurvivesStop: false,
      userDataMutable: 'when-stopped',
      kvm: 'nested',
      arm64Regions: 'all',
    };
  }

  async ensureNetwork(region: string): Promise<NetworkRef> {
    const ec2 = this.client(region);
    const tagFilter = { Name: `tag:${NETWORK_TAG.key}`, Values: [NETWORK_TAG.value] };
    const tags = [
      { Key: NETWORK_TAG.key, Value: NETWORK_TAG.value },
      { Key: MANAGED_TAG.key, Value: MANAGED_TAG.value },
    ];

    const vpcs = await this.call(() => ec2.send(new DescribeVpcsCommand({ Filters: [tagFilter] })));
    let vpcId: string | undefined = vpcs.Vpcs?.[0]?.VpcId;
    if (!vpcId) {
      const created = await this.call(() =>
        ec2.send(
          new CreateVpcCommand({
            CidrBlock: this.options.vpcCidr ?? '10.42.0.0/16',
            TagSpecifications: [{ ResourceType: 'vpc', Tags: tags }],
          }),
        ),
      );
      vpcId = created.Vpc?.VpcId;
      if (!vpcId) throw new MachineError('MACHINE_PROVIDER', 'CreateVpc returned no id');
      await this.call(() =>
        ec2.send(
          new ModifyVpcAttributeCommand({ VpcId: vpcId, EnableDnsSupport: { Value: true } }),
        ),
      );
      await this.call(() =>
        ec2.send(
          new ModifyVpcAttributeCommand({ VpcId: vpcId, EnableDnsHostnames: { Value: true } }),
        ),
      );
      const igw = await this.call(() =>
        ec2.send(
          new CreateInternetGatewayCommand({
            TagSpecifications: [{ ResourceType: 'internet-gateway', Tags: tags }],
          }),
        ),
      );
      const igwId = igw.InternetGateway?.InternetGatewayId;
      await this.call(() =>
        ec2.send(new AttachInternetGatewayCommand({ InternetGatewayId: igwId, VpcId: vpcId })),
      );
      const routeTables = await this.call(() =>
        ec2.send(
          new DescribeRouteTablesCommand({
            Filters: [{ Name: 'vpc-id', Values: [vpcId as string] }],
          }),
        ),
      );
      const mainTable = routeTables.RouteTables?.[0]?.RouteTableId;
      await this.call(() =>
        ec2.send(
          new CreateRouteCommand({
            RouteTableId: mainTable,
            DestinationCidrBlock: '0.0.0.0/0',
            GatewayId: igwId,
          }),
        ),
      );
    }

    const subnets = await this.call(() =>
      ec2.send(
        new DescribeSubnetsCommand({
          Filters: [{ Name: 'vpc-id', Values: [vpcId as string] }, tagFilter],
        }),
      ),
    );
    let subnetId: string | undefined = subnets.Subnets?.[0]?.SubnetId;
    if (!subnetId) {
      const created = await this.call(() =>
        ec2.send(
          new CreateSubnetCommand({
            VpcId: vpcId,
            CidrBlock: this.options.subnetCidr ?? '10.42.0.0/20',
            TagSpecifications: [{ ResourceType: 'subnet', Tags: tags }],
          }),
        ),
      );
      subnetId = created.Subnet?.SubnetId;
      if (!subnetId) throw new MachineError('MACHINE_PROVIDER', 'CreateSubnet returned no id');
    }

    const groups = await this.call(() =>
      ec2.send(
        new DescribeSecurityGroupsCommand({
          Filters: [{ Name: 'vpc-id', Values: [vpcId as string] }, tagFilter],
        }),
      ),
    );
    let securityGroupId: string | undefined = groups.SecurityGroups?.[0]?.GroupId;
    if (!securityGroupId) {
      // No inbound rule is ever added: the runner dials out, nothing listens.
      const created = await this.call(() =>
        ec2.send(
          new CreateSecurityGroupCommand({
            VpcId: vpcId,
            GroupName: 'oppenheimer-egress-only',
            Description: 'Oppenheimer machines: no inbound, all outbound',
            TagSpecifications: [{ ResourceType: 'security-group', Tags: tags }],
          }),
        ),
      );
      securityGroupId = created.GroupId;
      if (!securityGroupId)
        throw new MachineError('MACHINE_PROVIDER', 'CreateSecurityGroup returned no id');
    }

    return { kind: 'aws', region, ids: { vpcId, subnetId, securityGroupId } };
  }

  async create(spec: MachineSpec, idempotencyKey: string): Promise<MachineRef> {
    const shape = resolveShape('aws', spec);
    const ec2 = this.client(spec.region);
    const image = await this.resolveImage(spec, shape.arch);
    const tags = Object.entries(machineTags(idempotencyKey, spec.tags)).map(([Key, Value]) => ({
      Key,
      Value,
    }));

    const input: RunInstancesCommandInput = {
      ClientToken: idempotencyKey,
      ImageId: image.id,
      InstanceType: shape.name as RunInstancesCommandInput['InstanceType'],
      MinCount: 1,
      MaxCount: 1,
      SubnetId: spec.network.ids.subnetId,
      SecurityGroupIds: [spec.network.ids.securityGroupId],
      UserData: Buffer.from(spec.userData, 'utf8').toString('base64'),
      InstanceInitiatedShutdownBehavior: 'stop',
      MetadataOptions: {
        HttpEndpoint: 'enabled',
        HttpTokens: 'required',
        HttpPutResponseHopLimit: 1,
      },
      BlockDeviceMappings: [
        {
          DeviceName: image.rootDevice,
          Ebs: {
            VolumeType: 'gp3',
            VolumeSize: spec.diskGiB ?? DEFAULT_DISK_GIB,
            Encrypted: true,
            DeleteOnTermination: true,
          },
        },
      ],
      TagSpecifications: [
        { ResourceType: 'instance', Tags: tags },
        { ResourceType: 'volume', Tags: tags },
      ],
    };
    if (spec.kvm) {
      input.CpuOptions = { NestedVirtualization: 'enabled' };
    }
    if (spec.market === 'spot') {
      input.InstanceMarketOptions = {
        MarketType: 'spot',
        SpotOptions: { SpotInstanceType: 'one-time', InstanceInterruptionBehavior: 'terminate' },
      };
    }

    const result = await this.call(() => ec2.send(new RunInstancesCommand(input)));
    const id = result.Instances?.[0]?.InstanceId;
    if (!id) throw new MachineError('MACHINE_PROVIDER', 'RunInstances returned no instance');
    return { kind: 'aws', region: spec.region, id };
  }

  async start(ref: MachineRef): Promise<void> {
    await this.call(() =>
      this.client(ref.region).send(new StartInstancesCommand({ InstanceIds: [ref.id] })),
    );
  }

  async stop(ref: MachineRef, mode: 'stop' | 'suspend'): Promise<void> {
    if (mode === 'suspend') {
      throw unsupported('this driver launches without hibernation configured; send stop');
    }
    await this.call(() =>
      this.client(ref.region).send(new StopInstancesCommand({ InstanceIds: [ref.id] })),
    );
  }

  async destroy(ref: MachineRef): Promise<void> {
    try {
      await this.call(() =>
        this.client(ref.region).send(new TerminateInstancesCommand({ InstanceIds: [ref.id] })),
      );
    } catch (error) {
      if (error instanceof MachineError && error.code === 'MACHINE_NOT_FOUND') return;
      throw error;
    }
  }

  async describe(ref: MachineRef): Promise<MachineStatus> {
    const result = await this.call(() =>
      this.client(ref.region).send(new DescribeInstancesCommand({ InstanceIds: [ref.id] })),
    );
    const instance = result.Reservations?.[0]?.Instances?.[0];
    if (!instance) throw new MachineError('MACHINE_NOT_FOUND', ref.id);
    return this.toStatus(ref.region, instance);
  }

  async list(region: string, tag: TagFilter): Promise<MachineStatus[]> {
    const ec2 = this.client(region);
    const statuses: MachineStatus[] = [];
    let NextToken: string | undefined;
    do {
      const page = await this.call(() =>
        ec2.send(
          new DescribeInstancesCommand({
            Filters: [
              { Name: `tag:${tag.key}`, Values: [tag.value] },
              {
                Name: 'instance-state-name',
                Values: ['pending', 'running', 'stopping', 'stopped'],
              },
            ],
            NextToken,
          }),
        ),
      );
      for (const reservation of page.Reservations ?? []) {
        for (const instance of reservation.Instances ?? []) {
          statuses.push(this.toStatus(region, instance));
        }
      }
      NextToken = page.NextToken;
    } while (NextToken);
    return statuses;
  }

  async quote(spec: MachineSpec): Promise<MachineQuote | null> {
    const shape = resolveShape('aws', spec);
    const perHour = catalogPrice('aws', shape, spec.region);
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

  async consoleOutput(ref: MachineRef): Promise<string> {
    const result = await this.call(() =>
      this.client(ref.region).send(
        new GetConsoleOutputCommand({ InstanceId: ref.id, Latest: true }),
      ),
    );
    return result.Output ? Buffer.from(result.Output, 'base64').toString('utf8') : '';
  }

  private async resolveImage(
    spec: MachineSpec,
    arch: 'arm64' | 'amd64',
  ): Promise<{ id: string; rootDevice: string }> {
    const ec2 = this.client(spec.region);
    if (spec.image?.kind === 'id') {
      const described = await this.call(() =>
        ec2.send(
          new DescribeImagesCommand({ ImageIds: [spec.image?.kind === 'id' ? spec.image.id : ''] }),
        ),
      );
      const image = described.Images?.[0];
      if (!image?.ImageId) throw new MachineError('MACHINE_NOT_FOUND', `image ${spec.image.id}`);
      return { id: image.ImageId, rootDevice: image.RootDeviceName ?? '/dev/sda1' };
    }
    const described = await this.call(() =>
      ec2.send(
        new DescribeImagesCommand({
          Owners: [CANONICAL_OWNER],
          Filters: [
            {
              Name: 'name',
              Values: [`ubuntu/images/hvm-ssd-gp3/ubuntu-noble-24.04-${arch}-server-*`],
            },
            { Name: 'state', Values: ['available'] },
          ],
        }),
      ),
    );
    const newest = (described.Images ?? [])
      .filter(
        (image: { ImageId?: string; CreationDate?: string }) => image.ImageId && image.CreationDate,
      )
      .sort((a: { CreationDate?: string }, b: { CreationDate?: string }) =>
        (b.CreationDate as string).localeCompare(a.CreationDate as string),
      )[0];
    if (!newest?.ImageId)
      throw new MachineError('MACHINE_PROVIDER', `no Ubuntu 24.04 ${arch} image in ${spec.region}`);
    return { id: newest.ImageId, rootDevice: newest.RootDeviceName ?? '/dev/sda1' };
  }

  private toStatus(
    region: string,
    instance: {
      InstanceId?: string;
      State?: { Name?: string };
      PublicIpAddress?: string;
      PrivateIpAddress?: string;
      LaunchTime?: Date;
      Tags?: { Key?: string; Value?: string }[];
    },
  ): MachineStatus {
    const tags: Record<string, string> = {};
    for (const tag of instance.Tags ?? []) {
      if (tag.Key) tags[tag.Key] = tag.Value ?? '';
    }
    return {
      ref: { kind: 'aws', region, id: instance.InstanceId ?? '' },
      state: STATES[instance.State?.Name ?? ''] ?? 'unknown',
      publicIp: instance.PublicIpAddress,
      privateIp: instance.PrivateIpAddress,
      launchedAt: instance.LaunchTime,
      tags,
    };
  }

  private client(region: string): Ec2Sender {
    let client = this.clients.get(region);
    if (!client) {
      client = this.options.clientFactory
        ? this.options.clientFactory(region)
        : new EC2Client({ region, credentials: this.options.credentials });
      this.clients.set(region, client);
    }
    return client;
  }

  private async call<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      throw mapAwsError(error);
    }
  }
}

export function mapAwsError(error: unknown): MachineError {
  if (error instanceof MachineError) return error;
  const err = error as { name?: string; Code?: string; message?: string };
  const code = err.Code ?? err.name ?? '';
  const detail = err.message ?? String(error);
  const options = { providerCode: code, cause: error };
  if (CAPACITY.has(code)) return new MachineError('MACHINE_CAPACITY', detail, options);
  if (QUOTA.has(code)) return new MachineError('MACHINE_QUOTA', detail, options);
  if (CREDENTIALS.has(code)) return new MachineError('MACHINE_CREDENTIALS', detail, options);
  if (NOT_FOUND.has(code)) return new MachineError('MACHINE_NOT_FOUND', detail, options);
  return new MachineError('MACHINE_PROVIDER', detail, options);
}
