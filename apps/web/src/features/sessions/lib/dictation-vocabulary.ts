import type { HostEntity, ProjectEntity } from '@oppenheimer/frontend-consumer';

/**
 * The names New session already shows, for the dictation's tidy to spell as
 * written: the projects, their repositories (the full name and the bare
 * one, which is what people say), and the hosts. Read once, when a recording
 * is sent, from what the screen has loaded.
 */
export function dictationVocabulary(
  projects: readonly ProjectEntity[] | undefined,
  hosts: readonly HostEntity[] | undefined,
): string[] {
  const names: string[] = [];
  for (const project of projects ?? []) {
    if (!project.isUnassigned) names.push(project.name);
    for (const repository of project.repositories) {
      names.push(repository.fullName, repository.fullName.split('/').pop() ?? '');
    }
  }
  for (const host of hosts ?? []) names.push(host.name);
  return names;
}
