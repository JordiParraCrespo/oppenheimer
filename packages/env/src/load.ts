/**
 * Side-effect entrypoint, the `dotenv/config` replacement:
 *
 * ```ts
 * import '@oppenheimer/env/load';
 * ```
 *
 * loads the workspace root's `.env` / `.env.local` before anything else in the
 * importing module runs.
 */
import { loadEnv } from './index';

loadEnv();
