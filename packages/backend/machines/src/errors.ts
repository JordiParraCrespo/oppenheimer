/**
 * One short catalog for every driver. `MACHINE_CAPACITY` is the only
 * retryable failure; everything else needs a person or a different request.
 */
export type MachineErrorCode =
  | 'MACHINE_CAPACITY'
  | 'MACHINE_QUOTA'
  | 'MACHINE_CREDENTIALS'
  | 'MACHINE_UNSUPPORTED'
  | 'MACHINE_NOT_FOUND'
  | 'MACHINE_PROVIDER';

const TITLES: Record<MachineErrorCode, string> = {
  MACHINE_CAPACITY: 'The provider has no capacity for this machine right now',
  MACHINE_QUOTA: 'A provider quota or limit blocks this machine',
  MACHINE_CREDENTIALS: 'The cloud account credentials were refused',
  MACHINE_UNSUPPORTED: 'This provider cannot do that',
  MACHINE_NOT_FOUND: 'The machine does not exist at the provider',
  MACHINE_PROVIDER: 'The provider returned an error',
};

export class MachineError extends Error {
  readonly code: MachineErrorCode;
  readonly retryable: boolean;
  /** The provider's own error code, when it had one. */
  readonly providerCode?: string;
  readonly cause?: unknown;

  constructor(
    code: MachineErrorCode,
    detail?: string,
    options?: { providerCode?: string; cause?: unknown },
  ) {
    super(detail ? `${TITLES[code]}: ${detail}` : TITLES[code]);
    this.name = 'MachineError';
    this.code = code;
    this.retryable = code === 'MACHINE_CAPACITY';
    this.providerCode = options?.providerCode;
    this.cause = options?.cause;
  }

  get title(): string {
    return TITLES[code(this)];
  }
}

function code(error: MachineError): MachineErrorCode {
  return error.code;
}

export function isMachineError(value: unknown): value is MachineError {
  return value instanceof MachineError;
}

export function unsupported(detail: string): MachineError {
  return new MachineError('MACHINE_UNSUPPORTED', detail);
}
