import { takeCloudReplySchema } from '@oppenheimer/shared';
import { createZodDto } from 'nestjs-zod';

export class TakeCloudReplyRequest extends createZodDto(takeCloudReplySchema) {}
