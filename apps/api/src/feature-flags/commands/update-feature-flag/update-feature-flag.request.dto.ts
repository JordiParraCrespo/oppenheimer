import { updateFeatureFlagSchema } from '@oppenheimer/shared/feature-flags';
import { createZodDto } from 'nestjs-zod';

export class UpdateFeatureFlagRequest extends createZodDto(updateFeatureFlagSchema) {}
