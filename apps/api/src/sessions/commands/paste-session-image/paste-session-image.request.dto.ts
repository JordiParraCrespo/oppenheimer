import { pasteSessionImageSchema } from '@oppenheimer/shared';
import { createZodDto } from 'nestjs-zod';

export class PasteSessionImageRequest extends createZodDto(pasteSessionImageSchema) {}
