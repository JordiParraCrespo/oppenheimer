import { releaseCloudReplySchema } from '@oppenheimer/shared';
import { createZodDto } from 'nestjs-zod';

export class ReleaseCloudReplyRequest extends createZodDto(releaseCloudReplySchema) {}
