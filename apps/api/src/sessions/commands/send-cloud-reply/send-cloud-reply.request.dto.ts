import { sendCloudReplySchema } from '@oppenheimer/shared';
import { createZodDto } from 'nestjs-zod';

export class SendCloudReplyRequest extends createZodDto(sendCloudReplySchema) {}
