/**
 * What is still going on inside a project, asked of whoever owns sessions.
 *
 * Archiving retires a directory name for good, so it has to know whether
 * anything is still working in it — and that is not this module's knowledge.
 * The port keeps the dependency pointing the right way: `projects/` states what
 * it needs, and the module that owns sessions answers.
 */
export interface ProjectUsagePort {
  hasOpenSessions(projectId: string): Promise<boolean>;
}
