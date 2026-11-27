import { recordCloudEventsSchema } from '@oppenheimer/shared';
import { createZodDto } from 'nestjs-zod';

export class RecordCloudEventsRequest extends createZodDto(recordCloudEventsSchema) {}
