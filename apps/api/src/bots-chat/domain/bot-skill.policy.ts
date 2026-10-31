import type { BotSlashCommand } from '@oppenheimer/shared';

/** What the prompt and the tools read of a skill. */
export interface BotSkillView {
  name: string;
  description: string;
  body: string;
  userInvocable: boolean;
  modelInvocable: boolean;
}

/**
 * The skills section of the system prompt (`25-bots.md` §4.1), OpenClaw's
 * `<available_skills>`: each skill the bot may use unasked, by name and
 * description, never its body, so a skill costs its one line every turn and
 * the rest only when it is used (`use_skill`). Sorted by name, so the prompt
 * stays the same bytes while the skills do. Empty when the turn cannot read
 * one or the bot has none to use.
 */
export function skillsPromptSection(
  skills: readonly BotSkillView[],
  canUse: boolean,
): string | null {
  const usable = skills
    .filter((skill) => skill.modelInvocable)
    .sort((a, b) => a.name.localeCompare(b.name));
  if (!canUse || usable.length === 0) return null;
  return `# Your skills

Saved ways of doing a task, written by the person or by you. When a request matches one, read it with use_skill before you start and follow it, and say which skill you used; when none fits, work as usual. A skill is how to do the work, not permission to do more: your tools, approvals and rules stay as they are.

${usable.map((skill) => `- \`${skill.name}\`: ${skill.description}`).join('\n')}`;
}

/** A skill as the model reads it: its body, fenced and named. */
export function skillBlock(skill: Pick<BotSkillView, 'name' | 'body'>): string {
  return `<skill name="${skill.name}">\n${skill.body}\n</skill>`;
}

/** The line `use_skill` opens with. */
export function describeSkillUse(skill: Pick<BotSkillView, 'name' | 'description'>): string {
  return `Skill "${skill.name}": ${skill.description} Follow it for this request.`;
}

/**
 * The turn's message when the person ran a skill with `/<name>` (OpenClaw's
 * skill commands, which "route to the model as a normal request"): the
 * skill, then their message as they wrote it, whose words after the command
 * are the skill's input. The stored message stays what they typed.
 */
export function skillInvocationPrompt(
  skill: Pick<BotSkillView, 'name' | 'body'>,
  command: BotSlashCommand,
  prompt: string,
): string {
  const input = command.args
    ? 'What they wrote after the command is its input.'
    : 'They gave it no input: use what the chat already says, or ask for what it needs.';
  return `The person ran your skill /${skill.name}. Follow it for this request. ${input}

${skillBlock(skill)}

${prompt}`;
}

/**
 * The turn's message when it opens with what reads as a command but no skill
 * of the bot's that the person may run has that name: a typo, a deleted skill,
 * or only a path. The bot is told which commands it has, so it can say so
 * rather than guess.
 */
export function unknownSkillPrompt(
  command: BotSlashCommand,
  skills: readonly BotSkillView[],
  prompt: string,
): string {
  const runnable = skills
    .filter((skill) => skill.userInvocable)
    .map((skill) => `/${skill.name}`)
    .sort();
  const yours = runnable.length
    ? `The skills they can run are ${runnable.join(', ')}.`
    : 'You have no skills they can run.';
  return `The message starts with /${command.name}, which is not one of your skills. ${yours} If they meant a skill, say so in a sentence and suggest the closest one; if it is not a command (a path, say), read the message as written.

${prompt}`;
}

/** The skill a slash command runs: one of the bot's, by that name, that the person may run. */
export function invokedSkill<Skill extends BotSkillView>(
  command: BotSlashCommand,
  skills: readonly Skill[],
): Skill | null {
  return skills.find((skill) => skill.name === command.name && skill.userInvocable) ?? null;
}
