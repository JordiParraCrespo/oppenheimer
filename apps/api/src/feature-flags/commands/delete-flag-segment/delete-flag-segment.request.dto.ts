import { deleteFlagSegmentSchema } from '@oppenheimer/shared/feature-flags';
import { createZodDto } from 'nestjs-zod';

export class DeleteFlagSegmentRequest extends createZodDto(deleteFlagSegmentSchema) {}
