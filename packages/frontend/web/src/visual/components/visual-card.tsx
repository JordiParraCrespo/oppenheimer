import {
  cn,
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
  IconButton,
  Prose,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  useCopy,
} from '@oppenheimer/design-system-web';
import { Check, Copy, Maximize2 } from '@oppenheimer/design-system-web/icons';
import {
  parseVisual,
  type VisualBlock,
  type Visual as VisualSpec,
} from '@oppenheimer/shared/schemas/visual';
import { type ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Markdown } from '../../markdown';
import { VisualChart } from './visual-chart';
import { VisualCallout, VisualChecklist, VisualLinks, VisualRecord } from './visual-lists';
import { VisualMetrics } from './visual-metrics';
import { VisualProgress, VisualRanking, VisualRing } from './visual-shares';
import { VisualTable } from './visual-table';

function Block({ block }: { block: VisualBlock }): ReactNode {
  switch (block.type) {
    case 'markdown':
      return (
        <Prose className="max-w-none text-[13.5px]">
          <Markdown source={block.text} />
        </Prose>
      );
    case 'metrics':
      return <VisualMetrics block={block} />;
    case 'bar':
    case 'line':
    case 'area':
      return <VisualChart block={block} />;
    case 'ring':
      return <VisualRing block={block} />;
    case 'ranking':
      return <VisualRanking block={block} />;
    case 'table':
      return <VisualTable block={block} />;
    case 'checklist':
      return <VisualChecklist block={block} />;
    case 'progress':
      return <VisualProgress block={block} />;
    case 'record':
      return <VisualRecord block={block} />;
    case 'callout':
      return <VisualCallout block={block} />;
    case 'links':
      return <VisualLinks block={block} />;
  }
}

function ToolbarButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={<IconButton size="xs" shape="square" aria-label={label} onClick={onClick} />}
      >
        {children}
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

/** The blocks, each rising into place a beat after the one above it. */
function Blocks({ visual }: { visual: VisualSpec }) {
  return (
    <div className="flex min-w-0 flex-col gap-5">
      {visual.blocks.map((block, index) => (
        <div
          // biome-ignore lint/suspicious/noArrayIndexKey: a visual's blocks never move; their place is their identity.
          key={index}
          className="min-w-0 motion-safe:animate-appear"
          style={{ animationDelay: `${Math.min(index, 8) * 60}ms` }}
        >
          <Block block={block} />
        </div>
      ))}
    </div>
  );
}

/**
 * A visual an agent showed: its title and subtitle over its blocks, each
 * drawn with the console's own charts and type, in a card that sizes its
 * layout to its own width (two metric tiles across on a phone, four on a
 * wide pane). On hover it offers its data as JSON and a larger view.
 */
export function VisualCard({ visual, className }: { visual: VisualSpec; className?: string }) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const { copied, copy } = useCopy(JSON.stringify(visual, null, 2));
  return (
    <figure
      data-slot="visual"
      className={cn(
        'group/visual @container/visual m-0 flex w-full min-w-0 flex-col gap-4 rounded-2xl border border-border-subtle bg-card px-4.5 pt-4 pb-4.5 shadow-xs motion-safe:animate-appear',
        className,
      )}
    >
      <header className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <figcaption className="text-[15px] leading-snug font-medium tracking-[-0.005em] text-fg">
            {visual.title}
          </figcaption>
          {visual.subtitle ? <p className="m-0 text-xs text-fg-muted">{visual.subtitle}</p> : null}
        </div>
        <div className="-mt-0.5 -mr-1.5 flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity duration-fast group-hover/visual:opacity-100 focus-within:opacity-100 [@media(hover:none)]:opacity-100">
          <ToolbarButton
            label={copied ? t('common.visual.copiedData') : t('common.visual.copyData')}
            onClick={copy}
          >
            {copied ? <Check aria-hidden className="text-success" /> : <Copy aria-hidden />}
          </ToolbarButton>
          <ToolbarButton label={t('common.visual.expand')} onClick={() => setExpanded(true)}>
            <Maximize2 aria-hidden />
          </ToolbarButton>
        </div>
      </header>
      <Blocks visual={visual} />
      <Dialog open={expanded} onOpenChange={setExpanded}>
        <DialogContent
          size="lg"
          closeLabel={t('common.close')}
          className="max-w-[min(64rem,calc(100%-2rem))]"
        >
          <DialogHeader>
            <DialogTitle>{visual.title}</DialogTitle>
            {visual.subtitle ? (
              <p className="m-0 text-sm text-fg-muted">{visual.subtitle}</p>
            ) : null}
          </DialogHeader>
          <DialogBody className="@container/visual overflow-y-auto">
            <Blocks visual={visual} />
          </DialogBody>
        </DialogContent>
      </Dialog>
    </figure>
  );
}

/**
 * A visual from a spec nobody has checked yet (a transcript entry): drawn
 * when it is one, and otherwise a quiet note with what is wrong, folded, so a
 * bad spec never breaks the chat around it.
 */
export function Visual({ spec, className }: { spec: unknown; className?: string }) {
  const { t } = useTranslation();
  const parsed = parseVisual(spec);
  if (parsed.ok) return <VisualCard visual={parsed.visual} className={className} />;
  return (
    <details
      data-slot="visual-invalid"
      className={cn(
        'rounded-xl border border-dashed border-border-default px-3.5 py-2.5 text-xs text-fg-muted',
        className,
      )}
    >
      <summary className="cursor-pointer select-none">{t('common.visual.invalid')}</summary>
      <ul className="mt-2 mb-0 flex flex-col gap-1 pl-4 font-mono text-[11px]">
        {parsed.errors.map((error) => (
          <li key={error}>{error}</li>
        ))}
      </ul>
    </details>
  );
}
