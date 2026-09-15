import { updateUserSettingsSchema } from '@oppenheimer/shared';
import { createZodDto } from 'nestjs-zod';

export class UpdateUserSettingsRequest extends createZodDto(updateUserSettingsSchema) {}
