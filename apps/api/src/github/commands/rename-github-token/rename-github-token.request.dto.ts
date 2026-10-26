import { renameGithubTokenSchema } from '@oppenheimer/shared';
import { createZodDto } from 'nestjs-zod';

export class RenameGithubTokenRequest extends createZodDto(renameGithubTokenSchema) {}
