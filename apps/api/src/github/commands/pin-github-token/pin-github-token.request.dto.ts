import { pinGithubTokenSchema } from '@oppenheimer/shared';
import { createZodDto } from 'nestjs-zod';

export class PinGithubTokenRequest extends createZodDto(pinGithubTokenSchema) {}
