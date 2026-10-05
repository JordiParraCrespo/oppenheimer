import { searchText } from '@oppenheimer/frontend-web';
import { z } from 'zod';

/** What Google puts on the redirect: the code and our state, or the error a refusal names. */
export const googleReturnSearchSchema = z.object({
  code: searchText,
  state: searchText,
  error: searchText,
});
