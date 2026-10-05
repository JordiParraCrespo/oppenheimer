import { linkTaskSessionSchema } from '@oppenheimer/shared';
import { createZodDto } from 'nestjs-zod';

export class LinkTaskSessionRequest extends createZodDto(linkTaskSessionSchema) {}
