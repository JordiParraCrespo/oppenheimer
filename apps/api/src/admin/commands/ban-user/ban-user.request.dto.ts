import { banUserBodySchema } from '@oppenheimer/shared';
import { createZodDto } from 'nestjs-zod';

export class BanUserRequest extends createZodDto(banUserBodySchema) {}
