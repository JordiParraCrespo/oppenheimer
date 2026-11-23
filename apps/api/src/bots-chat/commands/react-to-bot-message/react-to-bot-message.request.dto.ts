import { reactToBotMessageSchema } from '@oppenheimer/shared';
import { createZodDto } from 'nestjs-zod';

export class ReactToBotMessageRequest extends createZodDto(reactToBotMessageSchema) {}
