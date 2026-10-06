import { setRepositoryWatchSchema } from '@oppenheimer/shared';
import { createZodDto } from 'nestjs-zod';

export class SetRepositoryWatchRequest extends createZodDto(setRepositoryWatchSchema) {}
