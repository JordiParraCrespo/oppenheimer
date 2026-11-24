import {
  cn,
  IconButton,
  SegmentedControl,
  SegmentedControlItem,
  Skeleton,
  useCopy,
} from '@oppenheimer/design-system-web';
import { CheckIcon, CopyIcon, InfoIcon, Maximize2Icon } from '@oppenheimer/design-system-web/icons';
import { type ReactNode, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DiagramDialog } from '../dialogs/diagram-dialog';
import { useDiagram } from '../hooks/use-diagram';
import { useScrollEdges } from '../hooks/use-scroll-edges';
import type { DrawnDiagram } from '../lib/diagram';

/** The frame every state of a diagram is drawn in, so nothing moves when it lands. */
const FRAME =
  'group/diagram relative my-0.5 overflow-hidden rounded-md border border-border-subtle bg-card';

/** How a diagram reads before it is drawn: across (`LR`, a sequence) or down. */
function across(source: string): boolean {
  return /^\s*(?:(?:graph|flowchart)\s+(?:LR|RL)\b|sequenceDiagram|gantt|timeline|journey|gitGraph)/m.test(
    source,
  );
}

/**
 * A diagram on its way: three quiet nodes joined by hairlines in the frame,
 * laid the way the diagram reads, at about the room the drawing will take.
 */
function DiagramSkeleton({ source, label }: { source: string; label: string }) {
  const lines = source.split('\n').filter((line) => line.trim()).length;
  const height = Math.min(360, Math.max(152, 40 + lines * 24));
  const row = across(source);
  return (
    <div
      aria-busy
      aria-label={label}
      role="img"
      className={cn(FRAME, 'flex items-center justify-center p-5')}
      // The room is the source's: a guess from its length, held until the drawing lands.
      style={{ minHeight: height }}
    >
      <div className={cn('flex items-center', row ? 'flex-row' : 'flex-col')}>
        {[0, 1, 2].map((index) => (
          <div key={index} className={cn('flex items-center', row ? 'flex-row' : 'flex-col')}>
            {index > 0 ? (
              <span aria-hidden className={cn('bg-border', row ? 'h-px w-8' : 'h-5 w-px')} />
            ) : null}
            <Skeleton shape="md" className={cn('h-8', index === 1 ? 'w-28' : 'w-20')} />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * The drawing at its own size, shrinking with the column down to three
 * tenths of it, so its words stay readable; past that it keeps its size and scrolls sideways in the
 * frame, never the page, its edges fading where there is more.
 */
function DiagramPicture({ diagram, alt }: { diagram: DrawnDiagram; alt: string }) {
  const floor = Math.min(diagram.width, Math.max(diagram.width * 0.9, 320));
  const { ref, before, after } = useScrollEdges<HTMLDivElement>(diagram);
  const fade = `linear-gradient(to right, ${before ? 'transparent' : '#000'}, #000 32px, #000 calc(100% - 32px), ${after ? 'transparent' : '#000'})`;
  return (
    <div
      ref={ref}
      className="overflow-x-auto overscroll-x-contain"
      // The edges fade only where there is more of the drawing to scroll to.
      style={before || after ? { maskImage: fade } : undefined}
    >
      <div className="px-5 py-4">
        <img
          src={diagram.src}
          alt={alt}
          width={diagram.width}
          height={diagram.height}
          draggable={false}
          className="motion-safe:animate-diagram-in"
          // The drawing's own size decides its box; inline so no prose style around it can.
          style={{
            display: 'block',
            // A tall drawing (a pie) shrinks to the chat's height, never stretched.
            width: 'auto',
            maxWidth: `min(100%, ${diagram.width}px)`,
            maxHeight: 'min(28rem, 70vh)',
            minWidth: floor,
            height: 'auto',
            margin: '0 auto',
            borderRadius: 0,
          }}
        />
      </div>
    </div>
  );
}

/** The source as written, in the frame, for the Source view. */
function DiagramSource({ source }: { source: string }) {
  return (
    <div className="overflow-x-auto px-4 pt-12 pb-4 font-mono text-[13px] leading-[1.7] whitespace-pre text-fg">
      {source}
    </div>
  );
}

/**
 * A `mermaid` fence drawn as a diagram, in the colours of the theme around
 * it: a hairline frame on the card, and on hover (always, on a touch
 * screen) a small toolbar to switch to the source, copy it, or open the
 * diagram large. It fades in once drawn; until then the frame holds a
 * quiet sketch of nodes. A source Mermaid cannot read shows `children`, the
 * fence as the reply's code block, with a note under it.
 */
export function MarkdownDiagram({ source, children }: { source: string; children: ReactNode }) {
  const { t } = useTranslation();
  const frame = useRef<HTMLDivElement>(null);
  const state = useDiagram(source, frame);
  const [view, setView] = useState<'diagram' | 'source'>('diagram');
  const [expanded, setExpanded] = useState(false);
  // Each opening starts fitted: the dialog is keyed by it, and stays mounted to close gently.
  const [openings, setOpenings] = useState(0);
  const { copied, copy } = useCopy(source);
  const copyLabel = copied ? t('common.copied') : t('common.markdown.diagram.copy');
  return (
    <div ref={frame} data-slot="markdown-diagram" className="min-w-0">
      {state.status === 'failed' ? (
        <>
          {children}
          <p className="mt-1.5 flex items-center gap-1.5 text-[12.5px] leading-normal text-fg-subtle">
            <InfoIcon aria-hidden className="size-3.5 shrink-0" />
            {t('common.markdown.diagram.unreadable')}
          </p>
        </>
      ) : state.status === 'pending' ? (
        <DiagramSkeleton source={source} label={t('common.markdown.diagram.drawing')} />
      ) : (
        <figure className={cn(FRAME, 'm-0')}>
          {view === 'diagram' ? (
            <DiagramPicture
              diagram={state.diagram}
              alt={state.diagram.title ?? t('common.markdown.diagram.title')}
            />
          ) : (
            <DiagramSource source={source} />
          )}
          <div
            className={cn(
              'absolute top-2 right-2 flex items-center gap-0.5 rounded-pill border border-border-subtle bg-popover/90 p-0.5 shadow-xs backdrop-blur-sm transition-opacity duration-fast ease-standard',
              view === 'diagram' &&
                'pointer-fine:opacity-0 pointer-fine:group-hover/diagram:opacity-100 pointer-fine:has-focus-visible:opacity-100',
            )}
          >
            <SegmentedControl
              aria-label={t('common.markdown.diagram.views')}
              value={view}
              onValueChange={(next) => setView(next as 'diagram' | 'source')}
            >
              <SegmentedControlItem value="diagram">
                {t('common.markdown.diagram.diagram')}
              </SegmentedControlItem>
              <SegmentedControlItem value="source">
                {t('common.markdown.diagram.source')}
              </SegmentedControlItem>
            </SegmentedControl>
            <IconButton
              size="sm"
              aria-label={copyLabel}
              title={copyLabel}
              onClick={copy}
              className="text-fg-subtle"
            >
              {copied ? <CheckIcon /> : <CopyIcon />}
            </IconButton>
            <IconButton
              size="sm"
              aria-label={t('common.markdown.diagram.expand')}
              title={t('common.markdown.diagram.expand')}
              onClick={() => {
                setOpenings(openings + 1);
                setExpanded(true);
              }}
              className="text-fg-subtle"
            >
              <Maximize2Icon />
            </IconButton>
          </div>
          <DiagramDialog
            key={openings}
            diagram={state.diagram}
            open={expanded}
            onOpenChange={setExpanded}
          />
        </figure>
      )}
    </div>
  );
}
