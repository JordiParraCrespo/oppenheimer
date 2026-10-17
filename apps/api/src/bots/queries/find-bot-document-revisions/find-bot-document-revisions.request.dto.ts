import { findBotDocumentRevisionsSchema } from '@oppenheimer/shared';
import { createZodDto } from 'nestjs-zod';

export class FindBotDocumentRevisionsRequest extends createZodDto(findBotDocumentRevisionsSchema) {}
