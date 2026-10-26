import { addGithubTokenSchema } from '@oppenheimer/shared';
import { createZodDto } from 'nestjs-zod';

export class AddGithubTokenRequest extends createZodDto(addGithubTokenSchema) {}
