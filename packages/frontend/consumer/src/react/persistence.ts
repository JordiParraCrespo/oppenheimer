import { apiTokensKeys } from './api-tokens.queries';
import { hostsKeys } from './hosts.queries';
import { installationsKeys } from './installations.queries';
import { profileKeys } from './profile.queries';
import { projectsKeys } from './projects.queries';
import { sessionsKeys } from './sessions.queries';

/**
 * Consumer features that never reach the persisted query cache: a session
 * record names a host, a repository and a branch, a host list names the
 * machines someone owns, a project names its repositories and its host, and a
 * credential list or a profile are not things to leave in a browser's storage
 * either. A consumer app passes this to
 * `createQueryPersistOptions`.
 */
export const CONSUMER_NON_PERSISTED_FEATURES: readonly string[] = [
  sessionsKeys.all[0],
  hostsKeys.all[0],
  installationsKeys.all[0],
  apiTokensKeys.all[0],
  profileKeys.all[0],
  projectsKeys.all[0],
];
