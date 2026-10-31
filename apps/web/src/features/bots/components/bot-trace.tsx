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
import { Globe, ListTodo, Search, UsersIcon, Wrench } from '@oppenheimer/design-system-web/icons';
import type { BotToolStep } from '@oppenheimer/frontend-consumer';
import { useExploredLine } from '@oppenheimer/frontend-web';
import type { TFunction } from 'i18next';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { BotSubagents } from '@/features/bots/components/bot-subagents';
import { OpenSessionButton } from '@/features/bots/components/open-session-button';
import { type TraceRun, traceRuns } from '@/features/bots/lib/explored-steps';
import { searchResults } from '@/features/bots/lib/search-results';
import {
  groupSummary,
  planItems,
  readableOutput,
  sharedKind,
  type ToolAction,
  toolAction,
} from '@/features/bots/lib/tool-activity';

const PLAN_MARK = { done: '✓', active: '→', pending: '○' } as const;

/** How much of a call's output shows before "+N lines", as Codex's transcript caps a call. */
const OUTPUT_LINES = 5;

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
  delegate: {
    icon: <UsersIcon />,
    title: (t, action) => ({ title: t('bots.chat.activity.delegated', { count: action.tasks }) }),
    // Each child's line, read from the runs the call stored.
    detail: (step, t, labels) => {
      const runs = step.subagents ?? [];
      if (runs.length === 0) return rawDetail(step, t, labels);
      const failed = runs.filter((run) => run.status !== 'completed').length;
      return {
        meta: failed > 0 ? t('bots.chat.activity.groupFailed', { count: failed }) : undefined,
        body: <BotSubagents runs={runs} />,
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
 * fold into one line ("Used 5 tools"), under their kind's glyph when they
 * share one, that opens to those same lines; calls that only looked around
 * (a `get_`, `list_`, `read_` or `search_` tool, the web search) fold into
 * their own "Explored" line that names what they read, "Exploring" while
 * the call running now is one more of them, and any other call ends that
 * run. A call that would have asked and ran says why on its line. A call
 * still running is not drawn here: the turn's live line says
 * what it is doing. A call that started a session carries Open session on
 * its own line.
 */
export function BotTrace({
  steps,
  live = false,
}: {
  steps: readonly BotToolStep[];
  /** The turn is still running, so a call with no output yet is in flight. */
  live?: boolean;
}) {
  const { t } = useTranslation();
  const exploredLine = useExploredLine();
  const labels: TraceOutputLabels = {
    raw: t('bots.chat.activity.rawOutput'),
    more: (count) => t('bots.chat.activity.moreLines', { count }),
    full: t('bots.chat.activity.fullLines'),
    less: t('bots.chat.activity.lessOutput'),
  };
  const lineOf = (step: BotToolStep) => {
    const action = toolAction(step);
    const view = viewOf(action);
    const { meta, body } = view.detail(step, t, labels);
    return (
      <TraceStep
        key={step.callId}
        icon={view.icon}
        {...view.title(t, action)}
        // A call that ran without its card says why: a standing grant, or your rule.
        meta={
          step.isError ? t('bots.chat.activity.stepFailed') : (meta ?? step.allowedBy ?? undefined)
        }
        tone={step.isError ? 'danger' : 'default'}
        action={step.sessionId ? <OpenSessionButton sessionId={step.sessionId} /> : undefined}
      >
        {body}
      </TraceStep>
    );
  };
  const failedOf = (run: TraceRun) => {
    const failed = run.steps.filter((step) => step.isError).length;
    return failed > 0 ? t('bots.chat.activity.groupFailed', { count: failed }) : undefined;
  };
  const runOf = (run: TraceRun) => {
    const [only] = run.steps;
    switch (run.kind) {
      case 'explored':
        return only && run.steps.length === 1 && !run.exploring ? (
          <Trace key={run.key}>{lineOf(only)}</Trace>
        ) : (
          <TraceGroup
            key={run.key}
            icon={<Search />}
            summary={
              run.exploring ? (
                <span className="motion-safe:animate-shimmer">
                  {t('bots.chat.activity.exploring')}
                </span>
              ) : (
                t('bots.chat.activity.explored')
              )
            }
            detail={exploredLine(run.parts)}
            failed={failedOf(run)}
          >
            {run.steps.map(lineOf)}
          </TraceGroup>
        );
      case 'tools': {
        if (only && run.steps.length === 1) return <Trace key={run.key}>{lineOf(only)}</Trace>;
        const actions = run.steps.map(toolAction);
        return (
          <TraceGroup
            key={run.key}
            icon={STEP_VIEWS[sharedKind(actions) ?? 'tool'].icon}
            summary={t(groupSummary(actions), { count: run.steps.length })}
            failed={failedOf(run)}
          >
            {run.steps.map(lineOf)}
          </TraceGroup>
        );
      }
    }
  };
  const runs = traceRuns(steps, live).map(runOf);
  if (runs.length === 0) return null;
  return runs.length === 1 ? runs[0] : <div className="flex flex-col">{runs}</div>;
}
