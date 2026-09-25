import { evaluateFeatureFlagSchema } from '@oppenheimer/shared/feature-flags';
import { createZodDto } from 'nestjs-zod';

export class EvaluateFeatureFlagRequest extends createZodDto(evaluateFeatureFlagSchema) {}
