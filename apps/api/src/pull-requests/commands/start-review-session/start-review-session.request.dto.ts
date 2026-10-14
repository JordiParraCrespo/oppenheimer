import { startReviewSessionSchema } from '@oppenheimer/shared';
import { createZodDto } from 'nestjs-zod';

export class StartReviewSessionRequest extends createZodDto(startReviewSessionSchema) {}
