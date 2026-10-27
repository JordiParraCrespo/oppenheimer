import { reportCloudStatusSchema } from '@oppenheimer/shared';
import { createZodDto } from 'nestjs-zod';

export class ReportCloudStatusRequest extends createZodDto(reportCloudStatusSchema) {}
