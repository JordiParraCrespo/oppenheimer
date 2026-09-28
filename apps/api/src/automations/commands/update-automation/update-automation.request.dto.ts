import { updateAutomationSchema } from '@oppenheimer/shared';
import { createZodDto } from 'nestjs-zod';

export class UpdateAutomationRequest extends createZodDto(updateAutomationSchema) {}
