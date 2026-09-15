import { updateProfileSchema } from '@oppenheimer/shared';
import { createZodDto } from 'nestjs-zod';

export class UpdateProfileRequest extends createZodDto(updateProfileSchema) {}
