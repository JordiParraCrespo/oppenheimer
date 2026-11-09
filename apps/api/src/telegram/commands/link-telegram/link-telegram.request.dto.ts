import { linkTelegramSchema } from '@oppenheimer/shared';
import { createZodDto } from 'nestjs-zod';

export class LinkTelegramRequest extends createZodDto(linkTelegramSchema) {}
