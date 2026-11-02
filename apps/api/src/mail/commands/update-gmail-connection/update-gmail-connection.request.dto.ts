import { updateGmailConnectionSchema } from '@oppenheimer/shared';
import { createZodDto } from 'nestjs-zod';

export class UpdateGmailConnectionRequest extends createZodDto(updateGmailConnectionSchema) {}
