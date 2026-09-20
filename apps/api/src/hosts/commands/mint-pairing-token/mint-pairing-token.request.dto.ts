import { mintPairingTokenSchema } from '@oppenheimer/shared';
import { createZodDto } from 'nestjs-zod';

export class MintPairingTokenRequest extends createZodDto(mintPairingTokenSchema) {}
