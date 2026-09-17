import { apiTokensKeys } from './api-tokens.queries';
import { profileKeys } from './profile.queries';

/**
 * Consumer features that never reach the persisted query cache: a credential
 * list and a profile are not things to leave in a browser's storage. A
 * consumer app passes this to `createQueryPersistOptions`.
 */
export const CONSUMER_NON_PERSISTED_FEATURES: readonly string[] = [
  apiTokensKeys.all[0],
  profileKeys.all[0],
];
