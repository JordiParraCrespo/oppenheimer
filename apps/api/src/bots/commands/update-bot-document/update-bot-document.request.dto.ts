import { updateBotDocumentSchema } from '@oppenheimer/shared';
import { createZodDto } from 'nestjs-zod';

export class UpdateBotDocumentRequest extends createZodDto(updateBotDocumentSchema) {}
