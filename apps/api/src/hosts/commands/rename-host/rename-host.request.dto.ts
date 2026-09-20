import { renameHostSchema } from '@oppenheimer/shared';
import { createZodDto } from 'nestjs-zod';

export class RenameHostRequest extends createZodDto(renameHostSchema) {}
