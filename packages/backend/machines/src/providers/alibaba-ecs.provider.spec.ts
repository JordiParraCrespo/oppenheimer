import { describe, expect, it, vi } from 'vitest';
import type { MachineSpec } from '../machine-provider';
import { AlibabaEcsProvider, type EcsApi, mapAlibabaError } from './alibaba-ecs.provider';

const credentials = { accessKeyId: 'LTAI', accessKeySecret: 'secret' };

const spec: MachineSpec = {
  region: 'eu-central-1',
  size: 'medium',
  kvm: false,
  userData: '#cloud-config\n',
  network: {
    kind: 'alibaba',
    region: 'eu-central-1',
    ids: { vpcId: 'vpc-1', vSwitchId: 'vsw-1', securityGroupId: 'sg-1', zoneId: 'eu-central-1a' },
  },
};

function fakeEcs(overrides: Partial<EcsApi> = {}): EcsApi {
  return {
    runInstances: vi.fn(async () => ({ body: { instanceIdSets: { instanceIdSet: ['i-abc'] } } })),
    startInstance: vi.fn(async () => ({})),
    stopInstance: vi.fn(async () => ({})),
    deleteInstance: vi.fn(async () => ({})),
    describeInstances: vi.fn(async () => ({ body: { instances: { instance: [] } } })),
    ...overrides,
  } as unknown as EcsApi;
}

describe('AlibabaEcsProvider', () => {
  it('refuses a KVM host, which Alibaba sells only on bare metal', async () => {
    const ecs = fakeEcs();
    const provider = new AlibabaEcsProvider({ credentials, clientFactory: () => ecs });

    await expect(provider.create({ ...spec, kvm: true }, 'm1')).rejects.toMatchObject({
      code: 'MACHINE_UNSUPPORTED',
    });
    expect(ecs.runInstances).not.toHaveBeenCalled();
  });

  it('runs a pay-as-you-go x86 instance in Frankfurt with the client token, ESSD PL0 and the tags', async () => {
    const ecs = fakeEcs();
    const provider = new AlibabaEcsProvider({ credentials, clientFactory: () => ecs });

    const ref = await provider.create(spec, 'machine-1');

    expect(ref).toEqual({ kind: 'alibaba', region: 'eu-central-1', id: 'i-abc' });
    const request = (ecs.runInstances as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(request).toMatchObject({
      regionId: 'eu-central-1',
      instanceType: 'ecs.g7a.xlarge',
      imageFamily: 'acs:ubuntu_24_04_x64',
      instanceChargeType: 'PostPaid',
      spotStrategy: 'NoSpot',
      clientToken: 'machine-1',
      securityGroupId: 'sg-1',
      vSwitchId: 'vsw-1',
      systemDisk: { category: 'cloud_essd', size: '40', performanceLevel: 'PL0' },
    });
    expect(request.tag.map((t: { key: string; value: string }) => [t.key, t.value])).toEqual(
      expect.arrayContaining([
        ['oppenheimer:managed', 'true'],
        ['oppenheimer:machine', 'machine-1'],
      ]),
    );
  });

  it('stops in economical mode and refuses suspend', async () => {
    const ecs = fakeEcs();
    const provider = new AlibabaEcsProvider({ credentials, clientFactory: () => ecs });
    const ref = { kind: 'alibaba' as const, region: 'eu-central-1', id: 'i-abc' };

    await provider.stop(ref, 'stop');
    await expect(provider.stop(ref, 'suspend')).rejects.toMatchObject({
      code: 'MACHINE_UNSUPPORTED',
    });

    expect((ecs.stopInstance as ReturnType<typeof vi.fn>).mock.calls[0][0]).toMatchObject({
      instanceId: 'i-abc',
      stoppedMode: 'StopCharging',
    });
  });

  it('describes a machine with its state, addresses and tags', async () => {
    const ecs = fakeEcs({
      describeInstances: vi.fn(async () => ({
        body: {
          instances: {
            instance: [
              {
                instanceId: 'i-abc',
                status: 'Stopped',
                creationTime: '2026-09-22T10:00Z',
                publicIpAddress: { ipAddress: ['1.2.3.4'] },
                vpcAttributes: { privateIpAddress: { ipAddress: ['10.42.0.5'] } },
                tags: { tag: [{ tagKey: 'oppenheimer:machine', tagValue: 'm1' }] },
              },
            ],
          },
        },
      })),
    } as unknown as Partial<EcsApi>);
    const provider = new AlibabaEcsProvider({ credentials, clientFactory: () => ecs });

    const status = await provider.describe({
      kind: 'alibaba',
      region: 'eu-central-1',
      id: 'i-abc',
    });

    expect(status).toMatchObject({
      state: 'stopped',
      publicIp: '1.2.3.4',
      privateIp: '10.42.0.5',
      tags: { 'oppenheimer:machine': 'm1' },
    });
  });

  it('decodes the serial console', async () => {
    const ecs = fakeEcs({
      getInstanceConsoleOutput: vi.fn(async () => ({
        body: { consoleOutput: Buffer.from('oppenheimer-smoke kvm=no').toString('base64') },
      })),
    } as unknown as Partial<EcsApi>);
    const provider = new AlibabaEcsProvider({ credentials, clientFactory: () => ecs });

    await expect(
      provider.consoleOutput({ kind: 'alibaba', region: 'eu-central-1', id: 'i-abc' }),
    ).resolves.toBe('oppenheimer-smoke kvm=no');
  });

  it('says a machine the provider does not know is not found', async () => {
    const provider = new AlibabaEcsProvider({ credentials, clientFactory: () => fakeEcs() });
    await expect(
      provider.describe({ kind: 'alibaba', region: 'eu-central-1', id: 'i-none' }),
    ).rejects.toMatchObject({
      code: 'MACHINE_NOT_FOUND',
    });
  });
});

describe('mapAlibabaError', () => {
  it.each([
    ['OperationDenied.NoStock', 'MACHINE_CAPACITY'],
    ['QuotaExceed.ElasticQuota', 'MACHINE_QUOTA'],
    ['InvalidAccessKeyId.NotFound', 'MACHINE_CREDENTIALS'],
    ['InvalidInstanceId.NotFound', 'MACHINE_NOT_FOUND'],
    ['Throttling', 'MACHINE_PROVIDER'],
  ])('maps %s to %s', (code, expected) => {
    expect(mapAlibabaError({ code, message: 'x' }).code).toBe(expected);
  });
});
