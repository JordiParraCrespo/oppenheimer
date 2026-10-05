import { cn, IconButton } from '@oppenheimer/design-system-web';
import { Ellipsis } from '@oppenheimer/design-system-web/icons';

/**
 * A goal over the board: its name, project and target, and how many of its tasks
 * are done. Pressing it filters the board to it; the ellipsis edits it.
 */
export function GoalCard({
  name,
  meta,
  target,
  countLabel,
  percent,
  complete,
  selected,
  editLabel,
  onPick,
  onEdit,
}: {
  name: string;
  /** The project's name. */
  meta: string;
  target: string;
  countLabel: string;
  percent: number;
  complete: boolean;
  selected: boolean;
  editLabel: string;
  onPick: () => void;
  onEdit: () => void;
}) {
  return (
    // biome-ignore lint/a11y/useSemanticElements: a card holding a button of its own (Edit).
    <div
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      onClick={onPick}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onPick();
        }
      }}
      className={cn(
        'flex cursor-pointer flex-col gap-3.5 rounded-lg border py-4 pr-3.5 pl-4.5 text-left outline-none transition-colors duration-fast focus-visible:outline-2 focus-visible:outline-ring',
        selected ? 'border-ring bg-selected-surface' : 'border-border-subtle bg-card',
      )}
    >
      <div className="flex items-start gap-2">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-body leading-[1.35] font-medium text-pretty">{name}</span>
          <span className="text-[12.5px] text-fg-muted">
            {meta}
            <span className="text-fg-subtle"> · </span>
            <span className="figures font-mono text-xs">{target}</span>
          </span>
        </div>
        <IconButton
          type="button"
          size="sm"
          aria-label={editLabel}
          className="-mt-1"
          onClick={(event) => {
            event.stopPropagation();
            onEdit();
          }}
        >
          <Ellipsis />
        </IconButton>
      </div>
      <div className="flex flex-col gap-2">
        <div className="h-1 overflow-hidden rounded-pill bg-hover-surface">
          <div
            className={cn(
              'h-full rounded-pill transition-[width] duration-slow',
              complete ? 'bg-success' : 'bg-fg',
            )}
            style={{ width: `${percent}%` }}
          />
        </div>
        <div className="figures flex items-baseline justify-between font-mono text-[11.5px] text-fg-muted">
          <span className="whitespace-nowrap">{countLabel}</span>
          <span>{percent}%</span>
        </div>
      </div>
    </div>
  );
}
