import { hostFoldersQuerySchema } from '@oppenheimer/shared';
import { createZodDto } from 'nestjs-zod';

export class FindHostFoldersRequest extends createZodDto(hostFoldersQuerySchema) {}
