import { claimCloudRepliesSchema } from '@oppenheimer/shared';
import { createZodDto } from 'nestjs-zod';

export class ClaimCloudRepliesRequest extends createZodDto(claimCloudRepliesSchema) {}
