import { createAutomationSchema } from '@oppenheimer/shared';
import { createZodDto } from 'nestjs-zod';

export class CreateAutomationRequest extends createZodDto(createAutomationSchema) {}
