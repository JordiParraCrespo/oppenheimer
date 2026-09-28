import { searchFlag } from '@oppenheimer/frontend-web';
import { z } from 'zod';

/** `?emailChanged=1` is how the change-email link returns here, and the screen says so. */
export const profileSearchSchema = z.object({ emailChanged: searchFlag });
