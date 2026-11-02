import { connectGmailSchema } from '@oppenheimer/shared';
import { createZodDto } from 'nestjs-zod';

export class ConnectGmailRequest extends createZodDto(connectGmailSchema) {}
