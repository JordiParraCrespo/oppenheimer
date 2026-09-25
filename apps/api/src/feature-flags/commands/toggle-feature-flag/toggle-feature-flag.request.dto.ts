import { toggleFeatureFlagSchema } from '@oppenheimer/shared/feature-flags';
import { createZodDto } from 'nestjs-zod';

export class ToggleFeatureFlagRequest extends createZodDto(toggleFeatureFlagSchema) {}
