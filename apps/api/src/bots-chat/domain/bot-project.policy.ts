/**
 * What a bot checks before it names a project (`25-bots.md` §4.3): a project
 * the person already has under that name. The console lets two projects share
 * a name, so this is the bot's own care, not a rule of the projects module: a
 * bot asked to "create local SEO" twice, or to rename one project onto
 * another's name, says so and asks rather than making a second one the
 * sidebar could not tell apart.
 */

/** The parts of a project the check reads. */
export interface NamedProject {
  id: string;
  name: string;
  archivedAt: Date | null;
}

/** Names compared as a person reads them: case and surrounding spaces ignored. */
export function projectNameKey(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
}

/** The projects already called `name`, archived ones included, but never `exceptId` itself. */
export function namesakesOf<Project extends NamedProject>(
  projects: readonly Project[],
  name: string,
  exceptId?: string,
): Project[] {
  const key = projectNameKey(name);
  return projects.filter(
    (project) => project.id !== exceptId && projectNameKey(project.name) === key,
  );
}

/**
 * Why a call that would name a project after another is refused, in words the
 * model passes on; null when no project has the name. An archived namesake is
 * named as such, since nothing new can go in it and the person may mean a
 * fresh one.
 */
export function namesakeRefusal(name: string, namesakes: readonly NamedProject[]): string | null {
  if (namesakes.length === 0) return null;
  const listed = namesakes
    .map((project) => `${project.id} "${project.name}"${project.archivedAt ? ' (archived)' : ''}`)
    .join(', ');
  return `A project named "${name.trim()}" already exists: ${listed}. Ask the person whether they mean that one; only if they want a second project with the same name, call again with allow_same_name true.`;
}
