import {
  ChatSource,
  ChatSources,
  Trace,
  TraceGroup,
  TraceNote,
  TraceOutput,
  type TraceOutputLabels,
  TraceStep,
} from '@oppenheimer/design-system-web';
import { Globe, ListTodo, Wrench } from '@oppenheimer/design-system-web/icons';
import type { BotToolStep } from '@oppenheimer/frontend-consumer';
import type { TFunction } from 'i18next';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { OpenSessionButton } from '@/features/bots/components/open-session-button';
import { searchResults } from '@/features/bots/lib/search-results';
import {
  groupSummary,
  planItems,
  readableOutput,
  type ToolAction,
  toolAction,
} from '@/features/bots/lib/tool-activity';

const PLAN_MARK = { done: '✓', active: '→', pending: '○' } as const;

/** How much of a call's output shows before "Show N more lines". */
const OUTPUT_LINES = 20;

type Kind = ToolAction['kind'];

/** What a step's line and its fold draw for one kind of call. */
interface StepView<K extends Kind> {
  icon: ReactNode;
  /** The line: "Searched the web for “x”", "Updated its plan", "Read document" + "notes.md". */
  title: (
    t: TFunction,
    action: Extract<ToolAction, { kind: K }>,
  ) => { title: string; target?: string };
  /** What it returned, readable first, and the figure for the line's meta. */
  detail: (
    step: BotToolStep,
    t: TFunction,
    labels: TraceOutputLabels,
  ) => { meta?: string; body: ReactNode };
}

/** The raw output, cut at `OUTPUT_LINES`, JSON indented; nothing when it returned nothing. */
function rawDetail(step: BotToolStep, _t: TFunction, labels: TraceOutputLabels) {
  return {
    body: step.output ? (
      <TraceOutput maxLines={OUTPUT_LINES} labels={labels}>
        {readableOutput(step.output)}
      </TraceOutput>
    ) : null,
  };
}

/**
 * One entry per kind of call: a new kind is a `ToolAction` kind in
 * `tool-activity.ts` and its entry here.
 */
const STEP_VIEWS: { [K in Kind]: StepView<K> } = {
  search: {
    icon: <Globe />,
    title: (t, action) => ({
      title: action.query
        ? t('bots.chat.activity.searchedFor', { query: action.query })
        : t('bots.chat.activity.searched'),
    }),
    // The pages the output carries as data, then the raw output behind a button.
    detail: (step, t, labels) => {
      const pages = searchResults(step.output ?? '');
      if (pages.length === 0) return rawDetail(step, t, labels);
      return {
        meta: t('bots.chat.activity.results', { count: pages.length }),
        body: (
          <div className="flex flex-col gap-2 pt-1">
            <ChatSources>
              {pages.map((page, index) => (
                <ChatSource key={page.url} index={index + 1} href={page.url} title={page.url}>
                  {page.title}
                </ChatSource>
              ))}
            </ChatSources>
            <TraceOutput maxLines={0} labels={labels}>
              {step.output ?? ''}
            </TraceOutput>
          </div>
        ),
      };
    },
  },
  plan: {
    icon: <ListTodo />,
    title: (t) => ({ title: t('bots.chat.activity.planned') }),
    // The to-do list it wrote, read from its input.
    detail: (step, t, labels) => {
      const items = planItems(step.input);
      if (items.length === 0) return rawDetail(step, t, labels);
      return {
        body: (
          <TraceNote>
            {items.map((item) => `${PLAN_MARK[item.state]} ${item.text}`).join('\n')}
          </TraceNote>
        ),
      };
    },
  },
  tool: {
    icon: <Wrench />,
    title: (_t, action) => ({ title: action.label, target: action.target }),
    detail: rawDetail,
  },
};

/** The view for a call's kind, typed to that kind. */
function viewOf<K extends Kind>(action: Extract<ToolAction, { kind: K }>): StepView<K> {
  return STEP_VIEWS[action.kind as K] as StepView<K>;
}

/**
 * A run of the bot's tool calls, as the trace the Bots frame draws: a quiet
 * line per call in plain verbs, failures in red, each opening to what it
 * returned, drawn by its kind's entry in `STEP_VIEWS`. Calls made together
 * fold into one line ("Used 5 tools") that opens to those same lines.
 * A call still running is not drawn here: the turn's live line says
 * what it is doing. A call that started a session carries Open session on
 * its own line.
 */
export function BotTrace({ steps }: { steps: readonly BotToolStep[] }) {
  const { t } = useTranslation();
  const labels: TraceOutputLabels = {
    raw: t('bots.chat.activity.rawOutput'),
    more: (count) => t('bots.chat.activity.moreLines', { count }),
    less: t('bots.chat.activity.lessOutput'),
  };
  const done = steps.filter((step) => step.output !== null);
  if (done.length === 0) return null;
  const items = done.map((step) => {
    const action = toolAction(step);
    const view = viewOf(action);
    const { meta, body } = view.detail(step, t, labels);
    return {
      step,
      icon: view.icon,
      body,
      props: {
        ...view.title(t, action),
        meta: step.isError ? t('bots.chat.activity.stepFailed') : meta,
        tone: step.isError ? ('danger' as const) : ('default' as const),
        action: step.sessionId ? <OpenSessionButton sessionId={step.sessionId} /> : undefined,
      },
    };
  });
  const [only] = items;
  if (items.length === 1 && only) {
    return (
      <Trace>
        <TraceStep icon={only.icon} {...only.props}>
          {only.body}
        </TraceStep>
      </Trace>
    );
  }
  const failed = done.filter((step) => step.isError).length;
  return (
    <TraceGroup
      summary={t(groupSummary(done.map(toolAction)), { count: done.length })}
      failed={failed > 0 ? t('bots.chat.activity.groupFailed', { count: failed }) : undefined}
    >
      {items.map(({ step, icon, props, body }) => (
        <TraceStep key={step.callId} icon={icon} {...props}>
          {body}
        </TraceStep>
      ))}
    </TraceGroup>
  );
}
