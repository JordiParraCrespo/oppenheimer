import { connectInstallationSchema } from '@oppenheimer/shared';
import { createZodDto } from 'nestjs-zod';

export class ConnectInstallationRequest extends createZodDto(connectInstallationSchema) {}
