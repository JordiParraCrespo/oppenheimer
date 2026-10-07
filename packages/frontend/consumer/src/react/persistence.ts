import { automationsKeys } from './automations.queries';
import { calendarKeys } from './calendar.queries';
import { hostsKeys } from './hosts.queries';
import { installationsKeys } from './installations.queries';
import { profileKeys } from './profile.queries';
import { projectsKeys } from './projects.queries';
import { pullRequestsKeys } from './pull-requests.queries';
import { sessionsKeys } from './sessions.queries';
import { tasksKeys } from './tasks.queries';

/**
 * Consumer features that never reach the persisted query cache: a session
 * record names a host, a repository and a branch, a host list names the
 * machines someone owns, an installation names GitHub accounts and their
 * repositories, a project names its repositories and its host, and a profile
 * is not a thing to leave in a browser's storage either, nor an automation's
 * prompt or the events its runs were started by. Plan's tasks name the work
 * and the sessions on it, and a calendar is someone's day, Google's included. Pull requests are
 * private repositories' code, diffs included. A consumer app passes this
 * to `createQueryPersistOptions`.
 *
 * The review period's numbers are the one read of that feature which is kept:
 * counts, medians, a lane mix and dates, naming no repository and holding no
 * code. It opts in where it is defined, with `meta: { persist: true }` on
 * `usePullRequestAnalytics`, so this list stays one entry per feature and the
 * default for anything new stays "not stored".
 */
export const CONSUMER_NON_PERSISTED_FEATURES: readonly string[] = [
  sessionsKeys.all[0],
  hostsKeys.all[0],
  installationsKeys.all[0],
  profileKeys.all[0],
  projectsKeys.all[0],
  automationsKeys.all[0],
  tasksKeys.all[0],
  calendarKeys.all[0],
  pullRequestsKeys.all[0],
];
