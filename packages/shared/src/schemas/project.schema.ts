import { z } from 'zod';
import { displayNameSchema } from './primitives';

/**
 * Project shapes.
 *
 * **There is no create DTO, because there is no create endpoint**: a project is
 * created implicitly by the first session that needs one, from the repository
 * that session checked out. So this file is rename only, and that is the whole
 * surface.
 *
 * `slug` is absent for a different reason: it is a directory name on every host
 * that holds the project, so renaming it would have to move `projects/<old>/` on
 * every machine with live sessions inside it. The slug is immutable and the name
 * is free — a path is never an identity.
 *
 * Schemas state the constraint only, never a message (`.agents/rules/forms.md`).
 */

/** `PATCH /projects/{id}`. Display name only. */
export const updateProjectSchema = z.object({
  name: displayNameSchema,
});

export type UpdateProjectDto = z.infer<typeof updateProjectSchema>;
