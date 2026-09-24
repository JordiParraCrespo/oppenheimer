import { clientFlagContextSchema } from '@oppenheimer/shared/feature-flags';
import { createZodDto } from 'nestjs-zod';

export class GetClientFeatureFlagsRequest extends createZodDto(clientFlagContextSchema) {}
