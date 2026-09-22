'use client';

import { CheckIcon, ChevronRightIcon } from 'lucide-react';
import * as React from 'react';

import { cn } from '../lib/utils';
import { AgentMark } from './agent-mark';
import { ChipSelectBack, ChipSelectEmpty, ChipSelectItem, ChipSelectPopup, ChipSelectSearch } from './chip-select';
import { ComposerToolButton } from './composer';
import { Popover, PopoverTrigger } from './popover';

/**
 * AgentModelSelect — the engine button in the composer's foot row: the
 * agent's mark and the model's name ("Claude Opus 5"). Opening lands on
 * the agent pane, the harness the session already uses checked and every
 * other one a step away; choosing one slides the same 252px popup to its
 * models, with a back row naming the agent, a search row and the check on
 * the current model. Harness first, then its models: the pair has to be
 * valid, and the second pane is the only place that guarantees it.
 *
 * An agent with no models (a blank terminal) is picked outright, and the
 * button then names the agent, because it is still the way back to a
 * different one.
 *
 * ```tsx
 * <AgentModelSelect
 *   agents={[{ id: 'claude-code', label: 'Claude Code', models: [{ value: 'claude-opus-5', label: 'Claude Opus 5' }] }]}
 *   value={{ agent: 'claude-code', model: 'claude-opus-5' }}
 *   onValueChange={setEngine}
 * />
 * ```
 */
type AgentModel = { value: string; label: string };

type AgentOption = {
  id: string;
  label: string;
  models: AgentModel[];
};

type Engine = { agent: string; model: string | null };

/** Rows visible before the list scrolls, as on the artboard. */
const VISIBLE_ROWS = 4;

/**
 * One row's height on the artboard: 6px above, 6px below, a 13px line at the
 * body's 1.47. The list is sized in rows rather than capped at a round number
 * so a short list is exactly as tall as it needs to be and a long one is cut
 * mid-row, which is what says "there is more" without a scrollbar.
 */
const ROW_HEIGHT = 30.5;

/**
 * The export's density for this menu: 13px rows, 9px gap, 6px/10px padding.
 *
 * `text-fg` undoes the chips' selected-row colour, and the check — which
 * inherits it — is put back to blue on its own. A `ChipSelect` row turns blue
 * when it is the current one because that is how the console's scope chips
 * read; this menu is drawn as a menu in the export, where the check is the
 * only blue thing and the label stays ink.
 */
const ROW_CLASSES = 'gap-[9px] leading-[1.47] text-fg [&>span:last-child]:text-link';

function AgentModelSelect({
  agents,
  value,
  onValueChange,
  searchPlaceholder = 'Search models…',
  emptyText = (query) => `No model matches “${query}”.`,
  disabled,
  className,
  'aria-label': ariaLabel = 'Agent and model',
}: {
  agents: AgentOption[];
  value: Engine;
  onValueChange: (value: Engine) => void;
  searchPlaceholder?: string;
  emptyText?: (query: string) => React.ReactNode;
  disabled?: boolean;
  className?: string;
  'aria-label'?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [pane, setPane] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState('');

  const current = agents.find((agent) => agent.id === value.agent);
  const currentModel = current?.models.find((model) => model.value === value.model);
  const sub = pane ? agents.find((agent) => agent.id === pane) : undefined;
  const term = query.trim().toLowerCase();
  const models = (sub?.models ?? []).filter((model) =>
    term ? model.label.toLowerCase().includes(term) : true,
  );

  function close() {
    setOpen(false);
    setPane(null);
    setQuery('');
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setPane(null);
          setQuery('');
        }
      }}
    >
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
          </ComposerToolButton>
        }
      />
      <ChipSelectPopup width={252} maxHeight={360} side="top" align="end">
        {sub ? (
          <>
            <ChipSelectBack
              className="mb-0 gap-2 rounded-sm border-b-0 px-2.5 py-[3px] text-[13px] leading-[1.47] hover:bg-hover-surface"
              onClick={() => {
                setPane(null);
                setQuery('');
              }}
            >
              <span className="flex items-center gap-2">
                <AgentMark agent={sub.id} />
                {sub.label}
              </span>
            </ChipSelectBack>
            <ChipSelectSearch
              // Full-bleed and hairlined on both edges, as the export draws it:
              // it divides the agent it belongs to from that agent's models,
              // rather than sitting under a heading like the chips' search does.
              rowClassName="-mx-1 my-1 border-t border-border-subtle px-[13px] py-[5px]"
              value={query}
              placeholder={searchPlaceholder}
              aria-label={searchPlaceholder}
              onChange={(event) => setQuery(event.target.value)}
            />
            <div
              role="listbox"
              aria-label={sub.label}
              className="overflow-y-auto [scrollbar-width:none]"
              // Sized from the agent's own list rather than the filtered one:
              // the box would otherwise resize under the cursor with every
              // keystroke in the search above it.
              style={{
                maxHeight:
                  Math.min(VISIBLE_ROWS, Math.max(1, sub.models.length)) * ROW_HEIGHT + 2,
              }}
            >
              {models.length > 0 ? (
                models.map((model) => (
                  <ChipSelectItem
                    key={model.value}
                    className={ROW_CLASSES}
                    selected={value.agent === sub.id && value.model === model.value}
                    onClick={() => {
                      onValueChange({ agent: sub.id, model: model.value });
                      close();
                    }}
                  >
                    {model.label}
                  </ChipSelectItem>
                ))
              ) : (
                <ChipSelectEmpty className="text-left text-fg-subtle">{emptyText(query)}</ChipSelectEmpty>
              )}
            </div>
          </>
        ) : (
          <div role="menu" aria-label={ariaLabel}>
            {agents.map((agent) => (
              <ChipSelectItem
                key={agent.id}
                role="menuitem"
                aria-current={agent.id === value.agent || undefined}
                leading={<AgentMark agent={agent.id} />}
                className={cn(ROW_CLASSES, '[&>span:last-child]:hidden')}
                onClick={() => {
                  if (agent.models.length === 0) {
                    onValueChange({ agent: agent.id, model: null });
                    close();
                  } else {
                    setPane(agent.id);
                    setQuery('');
                  }
                }}
              >
                <span className="flex items-center gap-2">
                  <span className="flex-1 truncate">{agent.label}</span>
                  {agent.id === value.agent ? (
                    <CheckIcon className="size-3.5 shrink-0 text-link" strokeWidth={2.5} aria-hidden />
                  ) : null}
                  {agent.models.length > 0 ? (
                    <ChevronRightIcon className={cn('size-3.5 shrink-0 text-fg-subtle')} aria-hidden />
                  ) : (
                    <span className="size-3.5 shrink-0" />
                  )}
                </span>
              </ChipSelectItem>
            ))}
          </div>
        )}
      </ChipSelectPopup>
    </Popover>
  );
}

export { AgentModelSelect };
export type { AgentModel, AgentOption, Engine };
