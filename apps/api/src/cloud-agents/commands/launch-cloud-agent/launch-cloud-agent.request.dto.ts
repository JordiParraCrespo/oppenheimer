import { launchCloudAgentSchema } from '@oppenheimer/shared';
import { createZodDto } from 'nestjs-zod';

export class LaunchCloudAgentRequest extends createZodDto(launchCloudAgentSchema) {}
