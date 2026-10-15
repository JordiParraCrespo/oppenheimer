import { Trace, TraceNote, TraceOutput, TraceStep } from '@oppenheimer/design-system-web';
import { Globe, ListTodo, Wrench } from '@oppenheimer/design-system-web/icons';
import type { BotToolStep } from '@oppenheimer/frontend-consumer';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { planItems, type ToolAction, toolAction } from '@/features/bots/lib/tool-activity';

const PLAN_MARK = { done: '✓', active: '→', pending: '○' } as const;

function actionIcon(action: ToolAction) {
  if (action.kind === 'search') return <Globe />;
  if (action.kind === 'plan') return <ListTodo />;
  return <Wrench />;
}

/** A call's line: "Searched the web for “x”", "Updated its plan", "Read document notes.md". */
function titleOf(t: TFunction, action: ToolAction): string {
  if (action.kind === 'search')
    return action.query
      ? t('bots.chat.activity.searchedFor', { query: action.query })
      : t('bots.chat.activity.searched');
  if (action.kind === 'plan') return t('bots.chat.activity.planned');
  return action.target ? `${action.label} ${action.target}` : action.label;
}

/**
 * A run of the bot's tool calls, as the trace the Bots frame draws: a quiet
 * line per call in plain verbs, failures in red, each opening to what it
 * returned (a search's results, a command's output) or, for a plan, the
 * to-do list it wrote. A call still running is not drawn here: the turn's
 * live line says what it is doing.
 */
export function BotTrace({ steps }: { steps: readonly BotToolStep[] }) {
  const { t } = useTranslation();
  const done = steps.filter((step) => step.output !== null);
  if (done.length === 0) return null;
  return (
    <Trace>
      {done.map((step) => {
        const action = toolAction(step);
        const plan = action.kind === 'plan' ? planItems(step.input) : [];
        return (
          <TraceStep
            key={step.callId}
            icon={actionIcon(action)}
            title={titleOf(t, action)}
            meta={step.isError ? t('bots.chat.activity.stepFailed') : undefined}
            tone={step.isError ? 'danger' : 'default'}
          >
            {plan.length > 0 ? (
              <TraceNote>
                {plan.map((item) => `${PLAN_MARK[item.state]} ${item.text}`).join('\n')}
              </TraceNote>
            ) : step.output ? (
              <TraceOutput>{step.output}</TraceOutput>
            ) : null}
          </TraceStep>
        );
      })}
    </Trace>
  );
}
