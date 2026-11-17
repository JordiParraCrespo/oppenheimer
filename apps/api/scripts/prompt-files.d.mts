/** One prompt a Markdown file holds: its id, its words and the slots in them. */
export interface PromptFilePrompt {
  id: string;
  text: string;
  slots: string[];
}

export function parsePromptFile(name: string, source: string, folder?: string): PromptFilePrompt[];
export function readPrompts(dir: string): PromptFilePrompt[];
export function renderPromptModule(prompts: readonly PromptFilePrompt[]): string;
