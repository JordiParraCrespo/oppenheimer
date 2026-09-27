import { listAutomationRunsQuerySchema } from '@oppenheimer/shared';
import { createZodDto } from 'nestjs-zod';

export class FindAutomationRunsRequest extends createZodDto(listAutomationRunsQuerySchema) {}
