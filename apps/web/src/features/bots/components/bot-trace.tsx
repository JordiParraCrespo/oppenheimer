import {
  ChatSource,
  ChatSources,
  Trace,
  TraceNote,
  TraceOutput,
  TraceStep,
} from '@oppenheimer/design-system-web';
import { Globe, ListTodo, Wrench } from '@oppenheimer/design-system-web/icons';
import type { BotToolStep } from '@oppenheimer/frontend-consumer';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import {
  planItems,
  readableOutput,
  searchResults,
  type ToolAction,
  toolAction,
} from '@/features/bots/lib/tool-activity';

const PLAN_MARK = { done: '✓', active: '→', pending: '○' } as const;

/** How much of a call's output shows before "Show N more lines". */
const OUTPUT_LINES = 20;

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
 * returned, readable first: a search's pages as numbered links with the
 * raw output behind "Show raw output", a plan as its to-do list, anything
 * else (JSON indented) cut at twenty lines with the rest a click away. A
 * call still running is not drawn here: the turn's live line says what it
 * is doing.
 */
export function BotTrace({ steps }: { steps: readonly BotToolStep[] }) {
  const { t } = useTranslation();
  const labels = {
    raw: t('bots.chat.activity.rawOutput'),
    more: (count: number) => t('bots.chat.activity.moreLines', { count }),
    less: t('bots.chat.activity.lessOutput'),
  };
  const done = steps.filter((step) => step.output !== null);
  if (done.length === 0) return null;
  return (
    <Trace>
      {done.map((step) => {
        const action = toolAction(step);
        const plan = action.kind === 'plan' ? planItems(step.input) : [];
        const output = step.output ?? '';
        const pages = action.kind === 'search' ? searchResults(output) : [];
        return (
          <TraceStep
            key={step.callId}
            icon={actionIcon(action)}
            title={titleOf(t, action)}
            meta={
              step.isError
                ? t('bots.chat.activity.stepFailed')
                : pages.length > 0
                  ? t('bots.chat.activity.results', { count: pages.length })
                  : undefined
            }
            tone={step.isError ? 'danger' : 'default'}
          >
            {plan.length > 0 ? (
              <TraceNote>
                {plan.map((item) => `${PLAN_MARK[item.state]} ${item.text}`).join('\n')}
              </TraceNote>
            ) : pages.length > 0 ? (
              <div className="flex flex-col gap-2 pt-1">
                <ChatSources>
                  {pages.map((page, index) => (
                    <ChatSource key={page.url} index={index + 1} href={page.url} title={page.url}>
                      {page.title}
                    </ChatSource>
                  ))}
                </ChatSources>
                <TraceOutput maxLines={0} labels={labels}>
                  {output}
                </TraceOutput>
              </div>
            ) : output ? (
              <TraceOutput maxLines={OUTPUT_LINES} labels={labels}>
                {readableOutput(output)}
              </TraceOutput>
            ) : null}
          </TraceStep>
        );
      })}
    </Trace>
  );
}
