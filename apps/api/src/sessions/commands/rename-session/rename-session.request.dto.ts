import { renameSessionSchema } from '@oppenheimer/shared';
import { createZodDto } from 'nestjs-zod';

export class RenameSessionRequest extends createZodDto(renameSessionSchema) {}
