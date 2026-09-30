import { describe, expect, it } from 'vitest';
import { MachineError } from './errors';
import { catalogPrice, resolveShape } from './sizes';

describe('resolveShape', () => {
  it('picks Intel nested-virtualisation instances for KVM hosts on AWS', () => {
    expect(resolveShape('aws', { size: 'medium', kvm: true, region: 'eu-central-1' }).name).toBe(
      'm8i.2xlarge',
    );
  });

  it('refuses an Arm KVM host on AWS, which sells nested virtualisation on Intel only', () => {
    expect(() =>
      resolveShape('aws', { size: 'small', kvm: true, arch: 'arm64', region: 'eu-central-1' }),
    ).toThrow(MachineError);
  });

  it('defaults to Arm on AWS when KVM is not needed', () => {
    expect(resolveShape('aws', { size: 'medium', kvm: false, region: 'eu-central-1' }).name).toBe(
      't4g.xlarge',
    );
  });

  it('picks E5.Flex with explicit OCPUs for KVM hosts on Oracle', () => {
    const shape = resolveShape('oci', { size: 'medium', kvm: true, region: 'eu-frankfurt-1' });
    expect(shape).toMatchObject({ name: 'VM.Standard.E5.Flex', ocpus: 4, memoryGiB: 32 });
  });

  it('refuses KVM on Alibaba, which sells it only on bare metal', () => {
    expect(() =>
      resolveShape('alibaba', { size: 'small', kvm: true, region: 'eu-central-1' }),
    ).toThrow(/bare metal/);
  });

  it('sells Arm on Alibaba only in Singapore', () => {
    expect(
      resolveShape('alibaba', { size: 'medium', kvm: false, region: 'ap-southeast-1' }).arch,
    ).toBe('arm64');
    expect(
      resolveShape('alibaba', { size: 'medium', kvm: false, region: 'eu-central-1' }).arch,
    ).toBe('amd64');
    expect(() =>
      resolveShape('alibaba', {
        size: 'medium',
        kvm: false,
        arch: 'arm64',
        region: 'eu-central-1',
      }),
    ).toThrow(/Singapore|ap-southeast-1/);
  });
});

describe('catalogPrice', () => {
  it('computes Oracle flex prices from OCPU and memory rates', () => {
    const shape = resolveShape('oci', { size: 'medium', kvm: true, region: 'eu-frankfurt-1' });
    expect(catalogPrice('oci', shape, 'eu-frankfurt-1')).toBe(0.184);
  });

  it('quotes null rather than guessing a region it has no number for', () => {
    const shape = resolveShape('aws', { size: 'medium', kvm: true, region: 'ap-south-1' });
    expect(catalogPrice('aws', shape, 'ap-south-1')).toBeNull();
  });
});
