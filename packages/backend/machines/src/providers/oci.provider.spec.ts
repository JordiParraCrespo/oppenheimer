import { describe, expect, it, vi } from 'vitest';
import type { MachineSpec } from '../machine-provider';
import { mapOciError, type OciClients, OciProvider } from './oci.provider';

const credentials = {
  tenancyId: 'ocid1.tenancy',
  userId: 'ocid1.user',
  fingerprint: 'aa:bb',
  privateKey: '-----BEGIN PRIVATE KEY-----',
  compartmentId: 'ocid1.compartment',
};

const spec: MachineSpec = {
  region: 'eu-frankfurt-1',
  size: 'medium',
  kvm: true,
  userData: '#cloud-config\n',
  network: {
    kind: 'oci',
    region: 'eu-frankfurt-1',
    ids: {
      compartmentId: 'ocid1.compartment',
      vcnId: 'vcn',
      subnetId: 'subnet',
      nsgId: 'nsg',
      availabilityDomain: 'AD-1',
    },
  },
};

function fakeClients(
  overrides: Partial<{ [K in keyof OciClients]: Partial<OciClients[K]> }> = {},
): OciClients {
  return {
    compute: {
      launchInstance: vi.fn(async () => ({ instance: { id: 'ocid1.instance' } })),
      instanceAction: vi.fn(async () => ({})),
      terminateInstance: vi.fn(async () => ({})),
      getInstance: vi.fn(async () => ({
        instance: { id: 'ocid1.instance', lifecycleState: 'RUNNING', freeformTags: {} },
      })),
      listInstances: vi.fn(async () => ({ items: [], opcNextPage: undefined })),
      listImages: vi.fn(async () => ({ items: [{ id: 'ocid1.image' }] })),
      captureConsoleHistory: vi.fn(async () => ({
        consoleHistory: { id: 'ocid1.history', lifecycleState: 'REQUESTED' },
      })),
      getConsoleHistory: vi
        .fn()
        .mockResolvedValueOnce({
          consoleHistory: { id: 'ocid1.history', lifecycleState: 'GETTING-HISTORY' },
        })
        .mockResolvedValue({
          consoleHistory: { id: 'ocid1.history', lifecycleState: 'SUCCEEDED' },
        }),
      getConsoleHistoryContent: vi.fn(async () => ({ value: 'oppenheimer-smoke kvm=yes' })),
      ...overrides.compute,
    } as unknown as OciClients['compute'],
    network: { ...overrides.network } as unknown as OciClients['network'],
    identity: { ...overrides.identity } as unknown as OciClients['identity'],
  };
}

describe('OciProvider', () => {
  it('launches an E5.Flex with the retry token, a private VNIC, the NSG and the tags', async () => {
    const clients = fakeClients();
    const provider = new OciProvider({ credentials, clientFactory: () => clients });

    const ref = await provider.create(spec, 'machine-1');

    expect(ref).toEqual({ kind: 'oci', region: 'eu-frankfurt-1', id: 'ocid1.instance' });
    const request = (clients.compute.launchInstance as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(request.opcRetryToken).toBe('machine-1');
    expect(request.launchInstanceDetails).toMatchObject({
      compartmentId: 'ocid1.compartment',
      availabilityDomain: 'AD-1',
      shape: 'VM.Standard.E5.Flex',
      shapeConfig: { ocpus: 4, memoryInGBs: 32 },
      sourceDetails: { sourceType: 'image', imageId: 'ocid1.image', bootVolumeSizeInGBs: 50 },
      createVnicDetails: { subnetId: 'subnet', assignPublicIp: false, nsgIds: ['nsg'] },
      freeformTags: { 'oppenheimer:managed': 'true', 'oppenheimer:machine': 'machine-1' },
    });
    expect(request.launchInstanceDetails.metadata.user_data).toBe(
      Buffer.from('#cloud-config\n').toString('base64'),
    );
  });

  it('never sizes a boot volume under the 50 GB floor', async () => {
    const clients = fakeClients();
    const provider = new OciProvider({ credentials, clientFactory: () => clients });

    await provider.create({ ...spec, diskGiB: 20 }, 'machine-2');

    const request = (clients.compute.launchInstance as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(request.launchInstanceDetails.sourceDetails.bootVolumeSizeInGBs).toBe(50);
  });

  it('refuses suspend and stops through the API, never an OS shutdown', async () => {
    const clients = fakeClients();
    const provider = new OciProvider({ credentials, clientFactory: () => clients });
    const ref = { kind: 'oci' as const, region: 'eu-frankfurt-1', id: 'ocid1.instance' };

    await expect(provider.stop(ref, 'suspend')).rejects.toMatchObject({
      code: 'MACHINE_UNSUPPORTED',
    });
    await provider.stop(ref, 'stop');

    expect(clients.compute.instanceAction).toHaveBeenCalledWith({
      instanceId: 'ocid1.instance',
      action: 'SOFTSTOP',
    });
  });

  it('lists by freeform tag across pages and drops terminated machines', async () => {
    const listInstances = vi
      .fn()
      .mockResolvedValueOnce({
        items: [
          { id: 'a', lifecycleState: 'RUNNING', freeformTags: { 'oppenheimer:managed': 'true' } },
          { id: 'b', lifecycleState: 'RUNNING', freeformTags: {} },
        ],
        opcNextPage: 'p2',
      })
      .mockResolvedValueOnce({
        items: [
          {
            id: 'c',
            lifecycleState: 'TERMINATED',
            freeformTags: { 'oppenheimer:managed': 'true' },
          },
        ],
        opcNextPage: undefined,
      });
    const clients = fakeClients({ compute: { listInstances } });
    const provider = new OciProvider({ credentials, clientFactory: () => clients });

    const machines = await provider.list('eu-frankfurt-1', {
      key: 'oppenheimer:managed',
      value: 'true',
    });

    expect(machines.map((m) => m.ref.id)).toEqual(['a']);
    expect(listInstances).toHaveBeenCalledTimes(2);
  });

  it('captures console history, waits for it, and returns its content', async () => {
    const clients = fakeClients();
    const sleep = vi.fn(async () => {});
    const provider = new OciProvider({ credentials, clientFactory: () => clients, sleep });

    const output = await provider.consoleOutput({
      kind: 'oci',
      region: 'eu-frankfurt-1',
      id: 'ocid1.instance',
    });

    expect(output).toBe('oppenheimer-smoke kvm=yes');
    expect(clients.compute.captureConsoleHistory).toHaveBeenCalledWith({
      captureConsoleHistoryDetails: { instanceId: 'ocid1.instance' },
    });
    expect(sleep).toHaveBeenCalledTimes(1);
  });

  it('quotes the flex shape from the OCPU and memory rates', async () => {
    const provider = new OciProvider({ credentials, clientFactory: () => fakeClients() });
    await expect(provider.quote(spec)).resolves.toMatchObject({ perHour: 0.184 });
  });
});

describe('mapOciError', () => {
  it('reads "Out of host capacity" as retryable capacity', () => {
    const mapped = mapOciError({
      statusCode: 500,
      serviceCode: 'InternalError',
      message: 'Out of host capacity.',
    });
    expect(mapped.code).toBe('MACHINE_CAPACITY');
    expect(mapped.retryable).toBe(true);
  });

  it.each([
    [{ statusCode: 400, serviceCode: 'LimitExceeded', message: 'x' }, 'MACHINE_QUOTA'],
    [{ statusCode: 401, serviceCode: 'NotAuthenticated', message: 'x' }, 'MACHINE_CREDENTIALS'],
    [
      { statusCode: 404, serviceCode: 'NotAuthorizedOrNotFound', message: 'x' },
      'MACHINE_NOT_FOUND',
    ],
    [{ statusCode: 409, serviceCode: 'Conflict', message: 'x' }, 'MACHINE_PROVIDER'],
  ])('maps %o to %s', (error, code) => {
    expect(mapOciError(error).code).toBe(code);
  });
});
