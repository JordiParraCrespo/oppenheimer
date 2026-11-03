import { startVoiceLiveSchema } from '@oppenheimer/shared';
import { createZodDto } from 'nestjs-zod';

export class StartVoiceLiveRequest extends createZodDto(startVoiceLiveSchema) {}
