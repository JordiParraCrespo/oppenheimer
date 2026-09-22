import { unsupported } from './errors';
import type { MachineArch, MachineSize, MachineSpec, ProviderKind } from './machine-provider';

/**
 * The size catalog, resolved per provider at create time. `kvm` hosts are
 * the ones a microVM session runs on and need nested virtualisation or bare
 * metal: Intel-only on AWS since February 2026, E5.Flex on Oracle, bare metal
 * only on Alibaba (product/15 §5).
 */
export interface Shape {
  /** The provider's instance type or shape name. */
  name: string;
  arch: MachineArch;
  vcpu: number;
  memoryGiB: number;
  /** Flex shapes (Oracle) take the OCPU and memory explicitly. */
  ocpus?: number;
}

const AWS: Record<'kvm' | 'arm64' | 'amd64', Record<MachineSize, Shape>> = {
  kvm: {
    small: { name: 'm8i.xlarge', arch: 'amd64', vcpu: 4, memoryGiB: 16 },
    medium: { name: 'm8i.2xlarge', arch: 'amd64', vcpu: 8, memoryGiB: 32 },
    large: { name: 'm8i.4xlarge', arch: 'amd64', vcpu: 16, memoryGiB: 64 },
  },
  arm64: {
    small: { name: 't4g.large', arch: 'arm64', vcpu: 2, memoryGiB: 8 },
    medium: { name: 't4g.xlarge', arch: 'arm64', vcpu: 4, memoryGiB: 16 },
    large: { name: 'm7g.2xlarge', arch: 'arm64', vcpu: 8, memoryGiB: 32 },
  },
  amd64: {
    small: { name: 't3a.large', arch: 'amd64', vcpu: 2, memoryGiB: 8 },
    medium: { name: 't3a.xlarge', arch: 'amd64', vcpu: 4, memoryGiB: 16 },
    large: { name: 'm7a.2xlarge', arch: 'amd64', vcpu: 8, memoryGiB: 32 },
  },
};

const OCI: Record<'kvm' | 'arm64', Record<MachineSize, Shape>> = {
  kvm: {
    small: { name: 'VM.Standard.E5.Flex', arch: 'amd64', vcpu: 4, memoryGiB: 16, ocpus: 2 },
    medium: { name: 'VM.Standard.E5.Flex', arch: 'amd64', vcpu: 8, memoryGiB: 32, ocpus: 4 },
    large: { name: 'VM.Standard.E5.Flex', arch: 'amd64', vcpu: 16, memoryGiB: 64, ocpus: 8 },
  },
  arm64: {
    small: { name: 'VM.Standard.A1.Flex', arch: 'arm64', vcpu: 2, memoryGiB: 8, ocpus: 2 },
    medium: { name: 'VM.Standard.A1.Flex', arch: 'arm64', vcpu: 4, memoryGiB: 16, ocpus: 4 },
    large: { name: 'VM.Standard.A1.Flex', arch: 'arm64', vcpu: 8, memoryGiB: 32, ocpus: 8 },
  },
};

const ALIBABA: Record<'arm64' | 'amd64', Record<MachineSize, Shape>> = {
  arm64: {
    small: { name: 'ecs.c8y.large', arch: 'arm64', vcpu: 2, memoryGiB: 4 },
    medium: { name: 'ecs.g8y.xlarge', arch: 'arm64', vcpu: 4, memoryGiB: 16 },
    large: { name: 'ecs.g8y.2xlarge', arch: 'arm64', vcpu: 8, memoryGiB: 32 },
  },
  amd64: {
    small: { name: 'ecs.c7a.large', arch: 'amd64', vcpu: 2, memoryGiB: 4 },
    medium: { name: 'ecs.g7a.xlarge', arch: 'amd64', vcpu: 4, memoryGiB: 16 },
    large: { name: 'ecs.g7a.2xlarge', arch: 'amd64', vcpu: 8, memoryGiB: 32 },
  },
};

/** Arm (Yitian) is sold outside mainland China only in Singapore. */
export const ALIBABA_ARM_REGIONS = ['ap-southeast-1'];

export function resolveShape(
  kind: ProviderKind,
  spec: Pick<MachineSpec, 'size' | 'kvm' | 'arch' | 'region'>,
): Shape {
  switch (kind) {
    case 'aws': {
      if (spec.kvm) {
        if (spec.arch === 'arm64') {
          throw unsupported(
            'AWS sells nested virtualisation on Intel instances only; pick amd64 or drop kvm',
          );
        }
        return AWS.kvm[spec.size];
      }
      return AWS[spec.arch ?? 'arm64'][spec.size];
    }
    case 'oci': {
      if (spec.kvm) {
        if (spec.arch === 'arm64') {
          throw unsupported(
            'Oracle has no nested virtualisation on Ampere A1; pick amd64 or drop kvm',
          );
        }
        return OCI.kvm[spec.size];
      }
      if (spec.arch === 'amd64') {
        return { ...OCI.kvm[spec.size] };
      }
      return OCI.arm64[spec.size];
    }
    case 'alibaba': {
      if (spec.kvm) {
        throw unsupported(
          'Alibaba Cloud sells KVM only on 104-vCPU bare metal, which this driver does not offer',
        );
      }
      const arch = spec.arch ?? (ALIBABA_ARM_REGIONS.includes(spec.region) ? 'arm64' : 'amd64');
      if (arch === 'arm64' && !ALIBABA_ARM_REGIONS.includes(spec.region)) {
        throw unsupported(
          `Alibaba Cloud sells Arm shapes outside China only in ${ALIBABA_ARM_REGIONS.join(', ')}`,
        );
      }
      return ALIBABA[arch][spec.size];
    }
  }
}

/**
 * List prices in USD per hour, on demand, checked 2026-09-22 (product/14 §4,
 * product/15 §5). Keyed by shape and region; a shape or region not listed
 * quotes null rather than a guess.
 */
export const PRICE_CATALOG_DATE = '2026-09-22';

const PRICES: Record<string, Record<string, number>> = {
  'aws:m8i.xlarge': { 'us-east-1': 0.2117, 'eu-central-1': 0.2536 },
  'aws:m8i.2xlarge': { 'us-east-1': 0.4234, 'eu-central-1': 0.5072 },
  'aws:t4g.xlarge': { 'us-east-1': 0.1344, 'eu-central-1': 0.1536 },
  'aws:m7g.2xlarge': { 'us-east-1': 0.3264, 'eu-central-1': 0.391 },
  'aws:t3a.xlarge': { 'us-east-1': 0.1504, 'eu-central-1': 0.1728 },
  'alibaba:ecs.c7a.xlarge': { 'eu-central-1': 0.138, 'ap-southeast-1': 0.15 },
  'alibaba:ecs.g7a.xlarge': { 'eu-central-1': 0.196, 'ap-southeast-1': 0.204 },
  'alibaba:ecs.g8y.xlarge': { 'ap-southeast-1': 0.192 },
};

/** Oracle prices one global list: per OCPU-hour plus per GB-hour. */
const OCI_FLEX_RATES: Record<string, { ocpu: number; gb: number }> = {
  'VM.Standard.E5.Flex': { ocpu: 0.03, gb: 0.002 },
  'VM.Standard.A1.Flex': { ocpu: 0.01, gb: 0.0015 },
};

export function catalogPrice(kind: ProviderKind, shape: Shape, region: string): number | null {
  if (kind === 'oci') {
    const rate = OCI_FLEX_RATES[shape.name];
    if (!rate || shape.ocpus === undefined) return null;
    return round(shape.ocpus * rate.ocpu + shape.memoryGiB * rate.gb);
  }
  const price = PRICES[`${kind}:${shape.name}`]?.[region];
  return price === undefined ? null : price;
}

function round(value: number): number {
  return Math.round(value * 10000) / 10000;
}
