import { hostFolderSearchQuerySchema } from '@oppenheimer/shared';
import { createZodDto } from 'nestjs-zod';

export class SearchHostFoldersRequest extends createZodDto(hostFolderSearchQuerySchema) {}
