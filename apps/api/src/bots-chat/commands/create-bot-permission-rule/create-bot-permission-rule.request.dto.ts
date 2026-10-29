import { createBotPermissionRuleSchema } from '@oppenheimer/shared';
import { createZodDto } from 'nestjs-zod';

export class CreateBotPermissionRuleRequest extends createZodDto(createBotPermissionRuleSchema) {}
