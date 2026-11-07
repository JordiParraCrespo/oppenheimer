import {
  type CreateProjectDto,
  createProjectSchema,
  type UpdateProjectDto,
  updateProjectSchema,
} from '@oppenheimer/shared';
import type { CodingAgentId } from '@oppenheimer/shared/agents';
import type { ZodType as SharedSchema, ZodTypeDef } from 'zod';

/**
 * How the project tools' input becomes the body the projects' own commands
 * take (`25-bots.md` §4.3): snake_case to the request DTO, checked against the
 * schema the console's route validates it with, so a bot cannot send what a
 * person could not; or, when it would not pass, the sentence that says which
 * field. Pure.
 */

/** One repository as a bot names it. */
export interface ProjectRepositoryToolInput {
  installation_id: string;
  github_repo_id: number;
  base_branch: string;
  is_default: boolean;
}

/** The fields `create_project` and `update_project` share, as a bot sends them. */
export interface ProjectToolInput {
  name?: string;
  repositories?: readonly ProjectRepositoryToolInput[];
  default_host_id?: string | null;
  default_agent?: CodingAgentId | null;
}

/** The body, or why there is none. */
export type ProjectBody<Dto> = { body: Dto } | { refusal: string };

export function createProjectBody(
  input: ProjectToolInput & { name: string },
): ProjectBody<CreateProjectDto> {
  return checked(createProjectSchema, {
    ...bodyOf(input),
    repositories: repositoriesOf(input) ?? [],
  });
}

export function updateProjectBody(input: ProjectToolInput): ProjectBody<UpdateProjectDto> {
  return checked(updateProjectSchema, { ...bodyOf(input), repositories: repositoriesOf(input) });
}

function bodyOf(input: ProjectToolInput) {
  return {
    name: input.name,
    defaultHostId: input.default_host_id,
    defaultAgent: input.default_agent,
  };
}

function repositoriesOf(input: ProjectToolInput) {
  return input.repositories?.map((repository) => ({
    installationId: repository.installation_id,
    githubRepoId: repository.github_repo_id,
    baseBranch: repository.base_branch,
    isDefault: repository.is_default,
  }));
}

function checked<Dto>(
  schema: SharedSchema<Dto, ZodTypeDef, unknown>,
  body: Record<string, unknown>,
): ProjectBody<Dto> {
  const defined = Object.fromEntries(
    Object.entries(body).filter(([, value]) => value !== undefined),
  );
  const parsed = schema.safeParse(defined);
  if (parsed.success) return { body: parsed.data };
  const issues = parsed.error.issues.map((issue) => {
    const field = issue.path.length ? `${issue.path.join('.')}: ` : '';
    // The shared schemas carry no messages (their package's rule); a rule of
    // their own is named by the field's description, which the model has.
    return issue.code === 'custom'
      ? `${field}breaks the rule its description gives`
      : `${field}${issue.message}`;
  });
  return { refusal: `Not a project the console would take: ${issues.join('; ')}.` };
}
