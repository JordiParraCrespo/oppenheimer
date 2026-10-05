import { searchText } from '@oppenheimer/frontend-web';
import { z } from 'zod';

/**
 * The board's address (`product/versions/mvp/18-plan-product.md` §1): the
 * project it is filtered to (its slug, or `unassigned`), the goal, which task's
 * dialog is open (`new` for New task) and which task the Start session dialog
 * is for. Each one is a link someone can send; the session header's "Back to
 * task" is `?task=`.
 */
export const boardSearchSchema = z.object({
  project: searchText,
  goal: searchText,
  task: searchText,
  start: searchText,
});
export type BoardSearch = z.infer<typeof boardSearchSchema>;

/** `?task=new`: the New task dialog rather than one task's. */
export const NEW_TASK = 'new';
