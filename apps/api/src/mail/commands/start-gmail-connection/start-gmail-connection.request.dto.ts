import { startGmailConnectionSchema } from '@oppenheimer/shared';
import { createZodDto } from 'nestjs-zod';

export class StartGmailConnectionRequest extends createZodDto(startGmailConnectionSchema) {}
