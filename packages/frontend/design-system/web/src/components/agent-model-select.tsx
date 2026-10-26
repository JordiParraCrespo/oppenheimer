'use client';

import { CircleQuestionMarkIcon, StarIcon } from 'lucide-react';
import * as React from 'react';

import { cn } from '../lib/utils';
import { AgentMark } from './agent-mark';
import { ChipSelectItem, ChipSelectList, ChipSelectPopup, ChipSelectSearch } from './chip-select';
import { ComposerToolButton } from './composer';
import { EffortSlider, type EffortStop } from './effort-slider';
import { Popover, PopoverTrigger } from './popover';

type AgentModel = { value: string; label: string };

type AgentOption = {
  id: string;
  label: string;
  models: AgentModel[];
};

type Engine = { agent: string; model: string | null };

/** How hard the current model thinks, drawn under the models and named on the button. */
type AgentModelEffort<V extends string = string> = {
  stops: readonly EffortStop<V>[];
  value: V;
  onValueChange: (value: V) => void;
};

type AgentModelSelectLabels = {
  favourites: string;
  favouritesEmpty: string;
  addFavourite: (model: string) => string;
  removeFavourite: (model: string) => string;
  effort: string;
  faster: string;
  smarter: string;
  effortHint: string;
};

const DEFAULT_LABELS: AgentModelSelectLabels = {
  favourites: 'Favourites',
  favouritesEmpty: 'Star a model to keep it here.',
  addFavourite: (model) => `Add ${model} to favourites`,
  removeFavourite: (model) => `Remove ${model} from favourites`,
  effort: 'Effort',
  faster: 'Faster',
  smarter: 'Smarter',
  effortHint:
    'How long the agent may think before it answers. Higher effort costs more and takes longer.',
};

/** Rows visible before the list scrolls. */
const VISIBLE_ROWS = 7;

/** The Favourites tab's id; no agent is called this. */
const FAVOURITES = '★';

const defaultEmptyText = (query: string): React.ReactNode => `No model matches “${query}”.`;

/** The key a favourite is kept by: the agent and the model, which only make sense together. */
function engineKey(engine: Engine): string {
  return `${engine.agent}:${engine.model ?? ''}`;
}

type Row = { agent: AgentOption; model: AgentModel | null };

/** An agent's rows: its models, or the agent itself when it has none (a blank terminal). */
function rowsOf(agent: AgentOption): Row[] {
  return agent.models.length > 0
    ? agent.models.map((model) => ({ agent, model }))
    : [{ agent, model: null }];
}

function rowKey(row: Row): string {
  return engineKey({ agent: row.agent.id, model: row.model?.value ?? null });
}

/**
 * The popup's three modes, as rows: a search spans every agent, the
 * Favourites tab the starred rows, an agent's tab that agent's. `total` sizes
 * the list from the whole set the mode draws from, so a search does not
 * resize it under the cursor; `mixed` says the rows are from several agents
 * and each should wear its mark.
 */
function rowsFor(
  agents: readonly AgentOption[],
  { term, tab, favourites }: { term: string; tab: string; favourites: readonly string[] },
): { rows: Row[]; total: number; mixed: boolean } {
  const all = agents.flatMap(rowsOf);
  if (term) {
    const rows = all.filter(({ agent, model }) =>
      `${model?.label ?? ''} ${agent.label}`.toLowerCase().includes(term),
    );
    return { rows, total: all.length, mixed: true };
  }
  if (tab === FAVOURITES) {
    const rows = all.filter((row) => favourites.includes(rowKey(row)));
    return { rows, total: rows.length, mixed: true };
  }
  const agent = agents.find((candidate) => candidate.id === tab);
  const rows = agent ? rowsOf(agent) : [];
  return { rows, total: rows.length, mixed: false };
}

/** The tab strip: Favourites when the caller keeps them, then one tab per agent's mark. */
function AgentModelTabs({
  tabs,
  selected,
  onSelect,
  'aria-label': ariaLabel,
}: {
  tabs: { id: string; label: string }[];
  selected: string | null;
  onSelect: (id: string) => void;
  'aria-label': string;
}) {
  return (
    <div role="tablist" aria-label={ariaLabel} className="flex gap-0.5 px-1.5 pt-1.5">
      {tabs.map((item) => {
        const on = selected === item.id;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={on}
            aria-label={item.label}
            title={item.label}
            onClick={() => onSelect(item.id)}
            className="group/tab flex flex-1 flex-col items-center gap-1.5 pt-1.5 outline-none"
          >
            <span
              className={cn(
                'flex h-7 w-8 items-center justify-center rounded-sm text-fg-muted transition-[background-color,opacity] duration-fast group-hover/tab:bg-hover-surface group-focus-visible/tab:outline-2 group-focus-visible/tab:outline-ring',
                on ? 'opacity-100' : 'opacity-55',
              )}
            >
              {item.id === FAVOURITES ? (
                <StarIcon className="size-4.5" fill="currentColor" strokeWidth={0} aria-hidden />
              ) : (
                <AgentMark agent={item.id} className="[&_svg]:size-4.5" />
              )}
            </span>
            <span className={cn('h-0.5 w-5 rounded-pill', on ? 'bg-fg' : 'bg-transparent')} />
          </button>
        );
      })}
    </div>
  );
}

/** A row's star: whether it is in Favourites, and the toggle. */
function AgentModelStar({
  starred,
  name,
  labels,
  onToggle,
}: {
  starred: boolean;
  name: string;
  labels: Pick<AgentModelSelectLabels, 'addFavourite' | 'removeFavourite'>;
  onToggle: () => void;
}) {
  const label = starred ? labels.removeFavourite(name) : labels.addFavourite(name);
  return (
    <button
      type="button"
      aria-pressed={starred}
      aria-label={label}
      title={label}
      onClick={onToggle}
      className={cn(
        'flex shrink-0 rounded-pill p-1.5 outline-none transition-colors duration-fast hover:bg-hover-surface focus-visible:outline-2 focus-visible:outline-ring',
        starred ? 'text-warning' : 'text-fg-subtle',
      )}
    >
      <StarIcon
        className="size-3.5"
        fill={starred ? 'currentColor' : 'none'}
        strokeWidth={1.8}
        aria-hidden
      />
    </button>
  );
}

/** The popup's foot: "Effort · Medium", the hint glyph, Faster and Smarter, and the slider. */
function AgentModelEffortFoot<V extends string>({
  effort,
  labels,
}: {
  effort: AgentModelEffort<V>;
  labels: Pick<AgentModelSelectLabels, 'effort' | 'faster' | 'smarter' | 'effortHint'>;
}) {
  const hintId = React.useId();
  const current = effort.stops.find((stop) => stop.value === effort.value) ?? effort.stops[0];
  return (
    <div
      data-slot="agent-model-effort"
      className="flex flex-col gap-[11px] border-t border-border-subtle px-3.5 py-[13px]"
    >
      <div className="flex items-center gap-2 text-[13px]">
        <span className="text-fg-muted">{labels.effort}</span>
        <span key={effort.value} className="motion-safe:animate-effort-in text-fg">
          {current?.label}
        </span>
        <span className="flex-1" />
        {/* The glyph is the pointer's way to the hint; the slider carries it as its description. */}
        <span className="flex text-fg-subtle" title={labels.effortHint}>
          <CircleQuestionMarkIcon className="size-[15px]" aria-hidden />
        </span>
        <span id={hintId} className="sr-only">
          {labels.effortHint}
        </span>
      </div>
      <div className="flex flex-col gap-2">
        <div className="flex justify-between text-xs text-fg-muted">
          <span>{labels.faster}</span>
          <span>{labels.smarter}</span>
        </div>
        <EffortSlider
          stops={effort.stops}
          value={effort.value}
          onValueChange={effort.onValueChange}
          aria-label={labels.effort}
          aria-describedby={hintId}
        />
      </div>
    </div>
  );
}

/**
 * AgentModelSelect — the engine button in the composer's foot row: the
 * agent's mark, the model's name and, muted after it, the effort. One button
 * for all three, so the row stays one line.
 *
 * It opens on a strip of tabs, one per agent's mark, the current agent's
 * open; its models list below a search row, the current one checked. Typing
 * searches every agent's models at once, and a row from another agent wears
 * that agent's mark. Picking a model picks its agent with it, so the pair is
 * always valid.
 *
 * Two parts are the caller's to switch on. With `onFavouritesChange`, a
 * Favourites tab leads the strip and each row ends in a star; the caller keeps
 * the list, as `engineKey`s. With `effort`, the popup ends in the effort
 * slider for the current model and the button names the level, in a cell as
 * wide as the longest level so the button never changes width under the
 * popup anchored to it.
 *
 * ```tsx
 * <AgentModelSelect
 *   agents={[{ id: 'claude-code', label: 'Claude Code', models: [{ value: 'claude-opus-5-5', label: 'Claude Opus 5.5' }] }]}
 *   value={{ agent: 'claude-code', model: 'claude-opus-5-5' }}
 *   onValueChange={setEngine}
 *   favourites={favourites}
 *   onFavouritesChange={setFavourites}
 *   effort={{ stops, value: effort, onValueChange: setEffort }}
 * />
 * ```
 */
function AgentModelSelect<V extends string = string>({
  agents,
  value,
  onValueChange,
  favourites = [],
  onFavouritesChange,
  effort,
  labels: labelsProp,
  searchPlaceholder = 'Search models…',
  emptyText: emptyTextProp,
  disabled,
  className,
  'aria-label': ariaLabel = 'Agent and model',
}: {
  agents: AgentOption[];
  value: Engine;
  onValueChange: (value: Engine) => void;
  /** Starred rows, as `engineKey`s, in the order they were starred. */
  favourites?: readonly string[];
  /** Present: the Favourites tab and the stars show. */
  onFavouritesChange?: (favourites: string[]) => void;
  effort?: AgentModelEffort<V>;
  labels?: Partial<AgentModelSelectLabels>;
  searchPlaceholder?: string;
  emptyText?: (query: string) => React.ReactNode;
  disabled?: boolean;
  className?: string;
  'aria-label'?: string;
}) {
  // Not a default parameter: the React Compiler skips a function-valued one.
  const emptyText = emptyTextProp ?? defaultEmptyText;
  const label = { ...DEFAULT_LABELS, ...labelsProp };
  const [open, setOpen] = React.useState(false);
  const [tab, setTab] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState('');

  const current = agents.find((agent) => agent.id === value.agent);
  const currentModel = current?.models.find((model) => model.value === value.model);
  const term = query.trim().toLowerCase();
  const shownTab = tab ?? value.agent;
  const { rows, total, mixed } = rowsFor(agents, { term, tab: shownTab, favourites });
  const tabs = [
    ...(onFavouritesChange ? [{ id: FAVOURITES, label: label.favourites }] : []),
    ...agents.map((agent) => ({ id: agent.id, label: agent.label })),
  ];

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      setTab(null);
      setQuery('');
    }
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger
        render={
          <ComposerToolButton
            icon={<AgentMark agent={value.agent} />}
            open={open}
            disabled={disabled}
            aria-label={ariaLabel}
            className={className}
          >
            {currentModel?.label ?? current?.label ?? value.agent}
            {effort ? (
              // Every stop in one cell: as wide as the longest, only the current one paints.
              <span className="ml-[7px] inline-grid text-fg-muted">
                {effort.stops.map((stop) => (
                  <span
                    key={stop.value}
                    aria-hidden={stop.value !== effort.value}
                    className={cn(
                      'col-start-1 row-start-1',
                      stop.value !== effort.value && 'invisible',
                    )}
                  >
                    {stop.label}
                  </span>
                ))}
              </span>
            ) : null}
          </ComposerToolButton>
        }
      />
      <ChipSelectPopup density="menu" side="top" align="end" width={340} className="p-0">
        <AgentModelTabs
          tabs={tabs}
          selected={term ? null : shownTab}
          onSelect={(id) => {
            setTab(id);
            setQuery('');
          }}
          aria-label={ariaLabel}
        />
        <div className="px-1">
          <ChipSelectSearch
            density="menu"
            value={query}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            onChange={(event) => setQuery(event.target.value)}
            className="text-[13px]"
          />
        </div>
        <ChipSelectList
          density="menu"
          role="listbox"
          aria-label={ariaLabel}
          rows={VISIBLE_ROWS}
          total={total}
          empty={rows.length === 0}
          emptyText={term ? emptyText(query) : label.favouritesEmpty}
          className="px-1 pb-1"
        >
          {rows.map((row) => {
            const key = rowKey(row);
            // A mark is aria-hidden: where agents mix, the name says whose row it is,
            // since two agents can offer the same model.
            const name = mixed && row.model
              ? `${row.model.label} · ${row.agent.label}`
              : (row.model?.label ?? row.agent.label);
            return (
              <div key={key} className="flex items-center">
                <ChipSelectItem
                  density="menu"
                  selected={value.agent === row.agent.id && value.model === (row.model?.value ?? null)}
                  leading={mixed ? <AgentMark agent={row.agent.id} /> : undefined}
                  className="min-w-0 flex-1"
                  aria-label={name}
                  onClick={() => {
                    onValueChange({ agent: row.agent.id, model: row.model?.value ?? null });
                    onOpenChange(false);
                  }}
                >
                  {row.model?.label ?? row.agent.label}
                </ChipSelectItem>
                {onFavouritesChange ? (
                  <AgentModelStar
                    starred={favourites.includes(key)}
                    name={name}
                    labels={label}
                    onToggle={() =>
                      onFavouritesChange(
                        favourites.includes(key)
                          ? favourites.filter((kept) => kept !== key)
                          : [...favourites, key],
                      )
                    }
                  />
                ) : null}
              </div>
            );
          })}
        </ChipSelectList>
        {effort ? <AgentModelEffortFoot effort={effort} labels={label} /> : null}
      </ChipSelectPopup>
    </Popover>
  );
}

export { AgentModelSelect, engineKey };
export type { AgentModel, AgentModelEffort, AgentModelSelectLabels, AgentOption, Engine };
