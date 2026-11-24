import { connectSlackSchema } from '@oppenheimer/shared';
import { createZodDto } from 'nestjs-zod';

export class ConnectSlackRequest extends createZodDto(connectSlackSchema) {}
