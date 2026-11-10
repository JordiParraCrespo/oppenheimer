import { createInboxReportSchema } from '@oppenheimer/shared';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/**
 * The text fields of a report, as a form sends them: every value a string,
 * and a field left empty sent as `''`. An empty field is an absent one, so
 * `link=` is no link and not a URL that fails to parse.
 */
const postInboxReportFormSchema = z.preprocess((form) => {
  if (typeof form !== 'object' || form === null) return form;
  return Object.fromEntries(
    Object.entries(form).filter(([, value]) => typeof value !== 'string' || value.trim() !== ''),
  );
}, createInboxReportSchema);

export class PostInboxReportRequest extends createZodDto(postInboxReportFormSchema) {}
