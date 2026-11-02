import { putSentryConnectionSchema } from '@oppenheimer/shared';
import { createZodDto } from 'nestjs-zod';

export class PutSentryConnectionRequest extends createZodDto(putSentryConnectionSchema) {}
