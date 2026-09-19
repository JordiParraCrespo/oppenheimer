import { z } from 'zod';

/**
 * Project shapes.
 *
 * `slug` is absent on purpose: it is a directory name on every host that holds
 * the project, so renaming it would have to move `projects/<old>/` on every
 * machine with live sessions inside it. The slug is immutable and the name is
 * free — a path is never an identity
 * (`product/versions/mvp/10-api-modules-and-data-model.md`).
 *
 * Schemas state the constraint only, never a message (`.agents/rules/forms.md`).
 */

/** `PATCH /projects/{id}`. Display name only. */
export const updateProjectSchema = z.object({
  name: z.string().min(1).max(200),
});

export type UpdateProjectDto = z.infer<typeof updateProjectSchema>;
