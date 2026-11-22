import { voiceSettingsSchema } from '@oppenheimer/shared';
import { createZodDto } from 'nestjs-zod';

export class UpdateVoiceSettingsRequest extends createZodDto(voiceSettingsSchema) {}
