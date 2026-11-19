import { PROMPT_TEXT, type PromptId, type PromptSlots } from './prompts/prompts.gen';

/** A prompt whose words have slots the code fills. */
type FilledPromptId = keyof PromptSlots;

/** A prompt that is sent as written. */
export type PlainPromptId = Exclude<PromptId, FilledPromptId>;

const SLOT = /\{\{([a-zA-Z][a-zA-Z0-9]*)\}\}/g;

/**
 * The words of one prompt, as `domain/prompts/*.md` writes them, with its
 * slots filled. The words are prose in Markdown; this is the one way they
 * reach the code, by id, so a prompt that is renamed or a slot left unfilled
 * does not compile. A value is put in as given, in one pass: what the person
 * or the bot wrote (a document, a fact) is never read for slots of its own.
 * A caller that gets past the types with a slot unfilled is refused: a model
 * is never sent a `{{name}}`.
 */
export function promptText(id: PlainPromptId): string;
export function promptText<Id extends FilledPromptId>(id: Id, values: PromptSlots[Id]): string;
export function promptText(id: PromptId, values: Readonly<Record<string, string>> = {}): string {
  return PROMPT_TEXT[id].replace(SLOT, (_slot, name: string) => {
    const value = values[name];
    if (value === undefined) throw new Error(`Prompt ${id} was given nothing for {{${name}}}.`);
    return value;
  });
}
