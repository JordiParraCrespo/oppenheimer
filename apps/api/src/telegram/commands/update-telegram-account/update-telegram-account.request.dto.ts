import { updateTelegramAccountSchema } from '@oppenheimer/shared';
import { createZodDto } from 'nestjs-zod';

export class UpdateTelegramAccountRequest extends createZodDto(updateTelegramAccountSchema) {}
