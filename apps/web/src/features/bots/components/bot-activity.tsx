import { ToolCallGroup, ToolCallRow } from '@oppenheimer/design-system-web';
import { Globe, ListTodo, LoaderIcon, Wrench } from '@oppenheimer/design-system-web/icons';
import type { BotToolStep } from '@oppenheimer/frontend-consumer';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import {
  type ActivityPhrase,
  activityPhrases,
  planItems,
  runningStep,
  type ToolAction,
  toolAction,
  toolTarget,
} from '@/features/bots/lib/tool-activity';

const PLAN_MARK = { done: '✓', active: '→', pending: '○' } as const;

function actionIcon(action: ToolAction) {
  if (action.kind === 'search') return <Globe />;
  if (action.kind === 'plan') return <ListTodo />;
  return <Wrench />;
}

/** One phrase of the settled line: "Searched the web for “x”", "Updated its plan". */
function donePhrase(t: TFunction, phrase: ActivityPhrase): string {
  if (phrase.kind === 'search') {
    if (phrase.count > 1) return t('bots.chat.activity.searchedTimes', { count: phrase.count });
    return phrase.query
      ? t('bots.chat.activity.searchedFor', { query: phrase.query })
      : t('bots.chat.activity.searched');
  }
  if (phrase.kind === 'plan') return t('bots.chat.activity.planned');
  return phrase.count > 1
    ? t('bots.chat.activity.toolTimes', { name: phrase.label, count: phrase.count })
    : phrase.label;
}

/** The line while a call runs: what it is doing now. */
function livePhrase(t: TFunction, action: ToolAction): string {
  if (action.kind === 'search')
    return action.query
      ? t('bots.chat.activity.searchingFor', { query: action.query })
      : t('bots.chat.activity.searching');
  if (action.kind === 'plan') return t('bots.chat.activity.planning');
  return t('bots.chat.activity.using', { name: action.label });
}

/** A call's row once open: the verb, what it was pointed at, and what came back. */
function rowOf(t: TFunction, step: BotToolStep) {
  const action = toolAction(step);
  if (action.kind === 'search')
    return { verb: t('bots.chat.activity.searched'), target: action.query, output: step.output };
  if (action.kind === 'plan') {
    const items = planItems(step.input);
    return {
      verb: t('bots.chat.activity.planned'),
      target: undefined,
      output: items.length
        ? items.map((item) => `${PLAN_MARK[item.state]} ${item.text}`).join('\n')
        : null,
    };
  }
  return { verb: action.label, target: toolTarget(step.input), output: step.output };
}

/**
 * A run of tool calls between two of the bot's replies, as one quiet line
 * (`25-bots.md` §3): what the bot is doing, with a spinner, while a call
 * runs ("Searching the web for “bun vs node”"); once settled, what it did in
 * plain verbs, with the steps counted when it did more than one thing
 * ("Searched the web for “bun vs node” · Updated its plan · 2 steps"),
 * failures in red. Open, a row per call whose input and output fold under it.
 */
export function BotActivity({ steps }: { steps: readonly BotToolStep[] }) {
  const { t } = useTranslation();
  const running = runningStep(steps);
  const phrases = activityPhrases(steps);
  const failed = steps.filter((step) => step.isError).length;
  const first = phrases[0];
  const summary = running
    ? livePhrase(t, toolAction(running))
    : [
        ...phrases.map((phrase) => donePhrase(t, phrase)),
        ...(phrases.length > 1 ? [t('bots.chat.activity.steps', { count: steps.length })] : []),
      ].join(' · ');

  return (
    <ToolCallGroup
      icon={
        running ? (
          <LoaderIcon className="motion-safe:animate-spin" />
        ) : first ? (
          actionIcon(first)
        ) : undefined
      }
      summary={
        <span className={running ? 'motion-safe:animate-shimmer' : undefined}>{summary}</span>
      }
      failed={failed > 0 ? t('bots.chat.activity.failed', { count: failed }) : undefined}
    >
      {steps.map((step) => {
        const row = rowOf(t, step);
        return (
          <ToolCallRow
            key={step.callId}
            icon={actionIcon(toolAction(step))}
            verb={row.verb}
            target={row.target}
            meta={
              step.output === null
                ? t('bots.chat.activity.running')
                : step.isError
                  ? t('bots.chat.activity.stepFailed')
                  : undefined
            }
            tone={step.isError ? 'danger' : 'default'}
            output={row.output || undefined}
          />
        );
      })}
    </ToolCallGroup>
  );
}
