import { updateFlagSegmentSchema } from '@oppenheimer/shared/feature-flags';
import { createZodDto } from 'nestjs-zod';

export class UpdateFlagSegmentRequest extends createZodDto(updateFlagSegmentSchema) {}
