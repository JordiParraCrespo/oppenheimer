import { PROMPT_TEXT, type PromptId, type PromptSlots } from './prompts/prompts.gen';

/** A prompt whose words have slots the code fills. */
type FilledPromptId = keyof PromptSlots;

/** A prompt that is sent as written. */
export type PlainPromptId = Exclude<PromptId, FilledPromptId>;

const SLOT = /\{\{([a-zA-Z][a-zA-Z0-9]*)\}\}/g;

/**
 * The words of one of this module's prompts, as `domain/prompts/*.md` writes
 * them, with its slots filled: the one way they reach the code, by id, so a
 * prompt renamed or a slot left unfilled does not compile. A value is put in
 * as given, in one pass, so text the person or a pull request wrote is never
 * read for slots of its own, and a model is never sent a `{{name}}`.
 */
export function sessionPromptText(id: PlainPromptId): string;
export function sessionPromptText<Id extends FilledPromptId>(
  id: Id,
  values: PromptSlots[Id],
): string;
export function sessionPromptText(
  id: PromptId,
  values: Readonly<Record<string, string>> = {},
): string {
  return PROMPT_TEXT[id].replace(SLOT, (_slot, name: string) => {
    const value = values[name];
    if (value === undefined) throw new Error(`Prompt ${id} was given nothing for {{${name}}}.`);
    return value;
  });
}
