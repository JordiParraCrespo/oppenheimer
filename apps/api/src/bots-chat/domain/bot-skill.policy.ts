import {
  BOT_OPPENHEIMER_SKILL,
  BOT_RECAP_SKILL,
  type BotBuiltInSkillName,
  type BotSlashCommand,
  botGoalCommandOf,
  botLoopCommandOf,
  botScheduleCommandOf,
  builtInSkillsBeside,
} from '@oppenheimer/shared';
import { goalSetPrompt } from './bot-goal.policy';
import { loopSetPrompt } from './bot-loop-message.factory';
import { promptText } from './bot-prompt-text.policy';
import { scheduleSetPrompt } from './bot-routine.policy';
import { BOT_SKILL_NUDGE_AFTER_STEPS, SKILL_NUDGE_TAG } from './bot-skill-learning.policy';

/** What the prompt and the tools read of a skill. */
export interface BotSkillView {
  name: string;
  description: string;
  body: string;
  userInvocable: boolean;
  modelInvocable: boolean;
}

/** A skill the product ships to every bot, listed while the tool it follows with is offered. */
export interface BotBuiltInSkill extends BotSkillView {
  /** One of `BOT_BUILT_IN_SKILL_NAMES`, which no skill of a bot's may be given. */
  name: BotBuiltInSkillName;
  /** The tool the skill's steps call: without it the skill has nothing to follow with. */
  needsTool: string;
}

/** {@link BOT_OPPENHEIMER_SKILL}, followed with Oppenheimer's own guide. */
export const OPPENHEIMER_SKILL: BotBuiltInSkill = {
  ...BOT_OPPENHEIMER_SKILL,
  needsTool: 'read_oppenheimer_docs',
};

/** {@link BOT_RECAP_SKILL}, which starts from the person's sessions. */
export const RECAP_SKILL: BotBuiltInSkill = {
  ...BOT_RECAP_SKILL,
  needsTool: 'list_sessions',
};

/** Every skill the product ships to every bot, in the order the prompt would list them. */
export const BOT_BUILT_IN_SKILLS: readonly BotBuiltInSkill[] = [OPPENHEIMER_SKILL, RECAP_SKILL];

/**
 * Every skill a bot has: its own, then each built-in whose name none of its
 * own holds (a skill saved under a built-in's name before it was reserved
 * stays the bot's). The one place that decides which skill a name means:
 * the prompt lists from it and `use_skill` reads from it.
 */
export function withBuiltInSkills<Skill extends BotSkillView>(
  skills: readonly Skill[],
): (Skill | BotBuiltInSkill)[] {
  return [...skills, ...builtInSkillsBeside(BOT_BUILT_IN_SKILLS, skills)];
}

/** Whether the skill is one Oppenheimer ships (`BOT_BUILT_IN_SKILLS`), not a row of the bot's. */
export function isBuiltInSkill(skill: object): skill is BotBuiltInSkill {
  return 'needsTool' in skill;
}

/** Whether a turn offering these tools can follow the skill: a built-in needs its tool. */
export function canFollowSkill(skill: BotSkillView, offeredTools: readonly string[]): boolean {
  return !('needsTool' in skill) || offeredTools.includes(skill.needsTool as string);
}

/**
 * The skills section of the system prompt, OpenClaw's
 * `<available_skills>`: each skill the bot may use unasked, by name and
 * description, never its body, so a skill costs its one line every turn and
 * the rest only when it is used (`use_skill`). Sorted by name, so the prompt
 * stays the same bytes while the skills do. A turn offered `save_skill` is
 * also told when to save one unasked (2026-11-09, Hermes Agent's learning
 * loop), in words that never change. Empty when the turn can neither read
 * nor save one, or can only read and has none to use.
 */
export function skillsPromptSection(
  skills: readonly BotSkillView[],
  offered: { use: boolean; save: boolean },
): string | null {
  const usable = offered.use
    ? skills.filter((skill) => skill.modelInvocable).sort((a, b) => a.name.localeCompare(b.name))
    : [];
  const parts: string[] = [];
  if (usable.length > 0) {
    parts.push(
      promptText('skills/system.using-them'),
      usable.map((skill) => `- \`${skill.name}\`: ${skill.description}`).join('\n'),
    );
  }
  if (offered.save) {
    parts.push(
      promptText('skills/system.saving-them', {
        steps: String(BOT_SKILL_NUDGE_AFTER_STEPS),
        tag: SKILL_NUDGE_TAG,
      }),
    );
  }
  return parts.length > 0 ? promptText('skills/system.body', { parts: parts.join('\n\n') }) : null;
}

/** A skill as the model reads it: its body, fenced and named. */
export function skillBlock(skill: Pick<BotSkillView, 'name' | 'body'>): string {
  return `<skill name="${skill.name}">\n${skill.body}\n</skill>`;
}

/** The line `use_skill` opens with. */
export function describeSkillUse(skill: Pick<BotSkillView, 'name' | 'description'>): string {
  return promptText('skills/tools.used', {
    name: skill.name,
    description: skill.description,
  });
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
  const input = promptText(
    command.args ? 'core/turn-slash-command.with-input' : 'core/turn-slash-command.with-no-input',
  );
  const ran = promptText('core/turn-slash-command.ran-a-skill', { name: skill.name, input });
  return `${ran}\n\n${skillBlock(skill)}\n\n${prompt}`;
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
    ? promptText('core/turn-slash-command.skills-they-can-run', { skills: runnable.join(', ') })
    : promptText('core/turn-slash-command.no-skills-to-run');
  const note = promptText('core/turn-slash-command.not-a-skill', { name: command.name, yours });
  return `${note}\n\n${prompt}`;
}

/**
 * A `/goal` that shows or clears the goal is the console's to run
 * (`GET`/`DELETE /bots/:id/goal`) and the API refuses to send one; this only
 * reads one that came from before that rule, so the bot answers in a line.
 */
function goalCommandPrompt(prompt: string): string {
  return `${promptText('core/turn-slash-command.goal-command')}\n\n${prompt}`;
}

/**
 * The turn's message, as the person's words become it:
 * a built-in command's directive (`/goal <condition>`, `/loop …`,
 * `/schedule <request>`), the skill their
 * `/<name>` runs before them, a note when the command names no skill they
 * can run, or the words alone when they typed no command. The one place a
 * slash command becomes the turn's message.
 */
export function composeTurnMessage(
  command: BotSlashCommand | null,
  skills: readonly BotSkillView[],
  prompt: string,
): string {
  if (!command) return prompt;
  const goal = botGoalCommandOf(command);
  if (goal) return goal.kind === 'set' ? goalSetPrompt(goal.condition) : goalCommandPrompt(prompt);
  const loop = botLoopCommandOf(command);
  if (loop) return loop.kind === 'set' ? loopSetPrompt(loop.intervalMinutes, loop.prompt) : prompt;
  const schedule = botScheduleCommandOf(command);
  if (schedule) return schedule.kind === 'set' ? scheduleSetPrompt(schedule.request) : prompt;
  const skill = invokedSkill(command, skills);
  return skill
    ? skillInvocationPrompt(skill, command, prompt)
    : unknownSkillPrompt(command, skills, prompt);
}

/** The skill a slash command runs: one of the bot's, by that name, that the person may run. */
export function invokedSkill<Skill extends BotSkillView>(
  command: BotSlashCommand,
  skills: readonly Skill[],
): Skill | null {
  return skills.find((skill) => skill.name === command.name && skill.userInvocable) ?? null;
}
