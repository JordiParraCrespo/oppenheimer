import {
  DescribeImagesCommand,
  DescribeInstancesCommand,
  RunInstancesCommand,
  StopInstancesCommand,
  TerminateInstancesCommand,
} from '@aws-sdk/client-ec2';
import { describe, expect, it } from 'vitest';
import { MachineError } from '../errors';
import type { MachineSpec } from '../machine-provider';
import { AwsEc2Provider, mapAwsError } from './aws-ec2.provider';

// biome-ignore lint/suspicious/noExplicitAny: fake responses per command class
type Handler = (input: any) => any;

function fakeEc2(handlers: Map<unknown, Handler>) {
  const sent: { name: string; input: unknown }[] = [];
  return {
    sent,
    client: {
      async send(command: { constructor: unknown; input: unknown }) {
        sent.push({ name: (command.constructor as { name: string }).name, input: command.input });
        const handler = handlers.get(command.constructor);
        if (!handler)
          throw new Error(`unexpected ${(command.constructor as { name: string }).name}`);
        return handler(command.input);
      },
    },
  };
}

const spec: MachineSpec = {
  region: 'eu-central-1',
  size: 'medium',
  kvm: true,
  userData: '#cloud-config\n',
  network: {
    kind: 'aws',
    region: 'eu-central-1',
    ids: { vpcId: 'vpc-1', subnetId: 'subnet-1', securityGroupId: 'sg-1' },
  },
};

describe('AwsEc2Provider', () => {
  it('creates a KVM host with nested virtualisation, IMDSv2, an encrypted root and the two tags', async () => {
    const fake = fakeEc2(
      new Map<unknown, Handler>([
        [
          DescribeImagesCommand,
          () => ({
            Images: [
              {
                ImageId: 'ami-old',
                CreationDate: '2026-01-01T00:00:00Z',
                RootDeviceName: '/dev/sda1',
              },
              {
                ImageId: 'ami-new',
                CreationDate: '2026-09-01T00:00:00Z',
                RootDeviceName: '/dev/sda1',
              },
            ],
          }),
        ],
        [RunInstancesCommand, () => ({ Instances: [{ InstanceId: 'i-123' }] })],
      ]),
    );
    const provider = new AwsEc2Provider({ clientFactory: () => fake.client });

    const ref = await provider.create(spec, 'machine-1');

    expect(ref).toEqual({ kind: 'aws', region: 'eu-central-1', id: 'i-123' });
    const run = fake.sent.find((s) => s.name === 'RunInstancesCommand')?.input as Record<
      string,
      unknown
    >;
    expect(run.ImageId).toBe('ami-new');
    expect(run.InstanceType).toBe('m8i.2xlarge');
    expect(run.ClientToken).toBe('machine-1');
    expect(run.CpuOptions).toEqual({ NestedVirtualization: 'enabled' });
    expect(run.MetadataOptions).toMatchObject({ HttpTokens: 'required' });
    expect(run.UserData).toBe(Buffer.from('#cloud-config\n').toString('base64'));
    expect(run.BlockDeviceMappings).toEqual([
      {
        DeviceName: '/dev/sda1',
        Ebs: { VolumeType: 'gp3', VolumeSize: 40, Encrypted: true, DeleteOnTermination: true },
      },
    ]);
    const tags = (
      run.TagSpecifications as { ResourceType: string; Tags: { Key: string; Value: string }[] }[]
    )[0].Tags;
    expect(tags).toEqual(
      expect.arrayContaining([
        { Key: 'oppenheimer:managed', Value: 'true' },
        { Key: 'oppenheimer:machine', Value: 'machine-1' },
      ]),
    );
  });

  it('refuses suspend rather than degrading it to stop', async () => {
    const fake = fakeEc2(new Map());
    const provider = new AwsEc2Provider({ clientFactory: () => fake.client });

    await expect(
      provider.stop({ kind: 'aws', region: 'eu-central-1', id: 'i-1' }, 'suspend'),
    ).rejects.toMatchObject({
      code: 'MACHINE_UNSUPPORTED',
    });
    expect(fake.sent).toHaveLength(0);
  });

  it('stops without hibernation', async () => {
    const fake = fakeEc2(new Map<unknown, Handler>([[StopInstancesCommand, () => ({})]]));
    const provider = new AwsEc2Provider({ clientFactory: () => fake.client });

    await provider.stop({ kind: 'aws', region: 'eu-central-1', id: 'i-1' }, 'stop');

    expect(fake.sent[0].input).toEqual({ InstanceIds: ['i-1'] });
  });

  it('treats terminating a machine that is already gone as success', async () => {
    const fake = fakeEc2(
      new Map<unknown, Handler>([
        [
          TerminateInstancesCommand,
          () => {
            throw Object.assign(new Error('gone'), { name: 'InvalidInstanceID.NotFound' });
          },
        ],
      ]),
    );
    const provider = new AwsEc2Provider({ clientFactory: () => fake.client });

    await expect(
      provider.destroy({ kind: 'aws', region: 'eu-central-1', id: 'i-1' }),
    ).resolves.toBeUndefined();
  });

  it('lists only live machines carrying the tag, across pages', async () => {
    let calls = 0;
    const fake = fakeEc2(
      new Map<unknown, Handler>([
        [
          DescribeInstancesCommand,
          (input: { NextToken?: string }) => {
            calls += 1;
            expect(input).toMatchObject({
              Filters: expect.arrayContaining([
                { Name: 'tag:oppenheimer:managed', Values: ['true'] },
              ]),
            });
            return input.NextToken
              ? {
                  Reservations: [
                    { Instances: [{ InstanceId: 'i-2', State: { Name: 'stopped' }, Tags: [] }] },
                  ],
                }
              : {
                  Reservations: [
                    {
                      Instances: [
                        {
                          InstanceId: 'i-1',
                          State: { Name: 'running' },
                          Tags: [{ Key: 'oppenheimer:machine', Value: 'm1' }],
                        },
                      ],
                    },
                  ],
                  NextToken: 'next',
                };
          },
        ],
      ]),
    );
    const provider = new AwsEc2Provider({ clientFactory: () => fake.client });

    const machines = await provider.list('eu-central-1', {
      key: 'oppenheimer:managed',
      value: 'true',
    });

    expect(calls).toBe(2);
    expect(machines.map((m) => [m.ref.id, m.state])).toEqual([
      ['i-1', 'running'],
      ['i-2', 'stopped'],
    ]);
    expect(machines[0].tags).toEqual({ 'oppenheimer:machine': 'm1' });
  });

  it('quotes from the catalog and says when it has no number', async () => {
    const provider = new AwsEc2Provider({ clientFactory: () => fakeEc2(new Map()).client });
    await expect(provider.quote(spec)).resolves.toMatchObject({
      perHour: 0.5072,
      shape: 'm8i.2xlarge',
    });
    await expect(provider.quote({ ...spec, region: 'ap-south-1' })).resolves.toBeNull();
  });
});

describe('mapAwsError', () => {
  it.each([
    ['InsufficientInstanceCapacity', 'MACHINE_CAPACITY', true],
    ['VcpuLimitExceeded', 'MACHINE_QUOTA', false],
    ['AuthFailure', 'MACHINE_CREDENTIALS', false],
    ['InvalidInstanceID.NotFound', 'MACHINE_NOT_FOUND', false],
    ['SomethingElse', 'MACHINE_PROVIDER', false],
  ])('maps %s to %s', (name, code, retryable) => {
    const mapped = mapAwsError(Object.assign(new Error('boom'), { name }));
    expect(mapped).toBeInstanceOf(MachineError);
    expect(mapped.code).toBe(code);
    expect(mapped.retryable).toBe(retryable);
    expect(mapped.providerCode).toBe(name);
  });
});
