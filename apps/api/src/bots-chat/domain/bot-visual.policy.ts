/**
 * `show_visual`: a bot draws a visual in the chat, a title and typed blocks
 * (`@oppenheimer/shared/schemas/visual`) the console draws with its own
 * charts. The spec rides on the call's data under this key; the step keeps
 * it, checked, for the chat's card. The model reads only the tool's words.
 */
export const VISUAL_DATA_KEY = 'visual';

/** Visuals one turn may draw: enough for an answer, never a wall of them. */
export const VISUALS_PER_TURN = 6;
