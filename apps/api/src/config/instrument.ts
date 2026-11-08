import '@oppenheimer/env/load';
import { initErrorReporting } from '@oppenheimer/backend-error-reporting/init';
import { errorReportingConfig } from './error-reporting.config';

// First import of `main.ts`: the SDK patches HTTP, Express, Postgres, ioredis
// and BullMQ as they load, so it starts before any of them is required.
initErrorReporting({ ...errorReportingConfig(), service: 'api' });
