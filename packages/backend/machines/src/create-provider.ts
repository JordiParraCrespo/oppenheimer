import type { MachineProvider } from './machine-provider';
import {
  AlibabaEcsProvider,
  type AlibabaEcsProviderOptions,
} from './providers/alibaba-ecs.provider';
import { AwsEc2Provider, type AwsEc2ProviderOptions } from './providers/aws-ec2.provider';
import { OciProvider, type OciProviderOptions } from './providers/oci.provider';

export type ProviderConfig =
  | ({ kind: 'aws' } & AwsEc2ProviderOptions)
  | ({ kind: 'oci' } & OciProviderOptions)
  | ({ kind: 'alibaba' } & AlibabaEcsProviderOptions);

/** One driver per connected cloud account. */
export function createMachineProvider(config: ProviderConfig): MachineProvider {
  switch (config.kind) {
    case 'aws':
      return new AwsEc2Provider(config);
    case 'oci':
      return new OciProvider(config);
    case 'alibaba':
      return new AlibabaEcsProvider(config);
  }
}
