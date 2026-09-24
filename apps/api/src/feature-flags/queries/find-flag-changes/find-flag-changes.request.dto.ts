import { findFlagChangesSchema } from '@oppenheimer/shared/feature-flags';
import { createZodDto } from 'nestjs-zod';

export class FindFlagChangesRequest extends createZodDto(findFlagChangesSchema) {}
