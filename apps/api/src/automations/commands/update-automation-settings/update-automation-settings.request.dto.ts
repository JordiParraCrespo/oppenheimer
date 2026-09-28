import { updateAutomationSettingsSchema } from '@oppenheimer/shared';
import { createZodDto } from 'nestjs-zod';

export class UpdateAutomationSettingsRequest extends createZodDto(updateAutomationSettingsSchema) {}
