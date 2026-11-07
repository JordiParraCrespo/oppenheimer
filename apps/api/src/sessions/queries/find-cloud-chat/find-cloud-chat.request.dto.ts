import { findCloudChatSchema } from '@oppenheimer/shared';
import { createZodDto } from 'nestjs-zod';

export class FindCloudChatRequest extends createZodDto(findCloudChatSchema) {}
