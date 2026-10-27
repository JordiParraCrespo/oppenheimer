import { followUpCloudAgentSchema } from '@oppenheimer/shared';
import { createZodDto } from 'nestjs-zod';

export class FollowUpCloudAgentRequest extends createZodDto(followUpCloudAgentSchema) {}
