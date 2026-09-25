import { createFlagSegmentSchema } from '@oppenheimer/shared/feature-flags';
import { createZodDto } from 'nestjs-zod';

export class CreateFlagSegmentRequest extends createZodDto(createFlagSegmentSchema) {}
