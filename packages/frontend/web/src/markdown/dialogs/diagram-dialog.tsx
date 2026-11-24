import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  IconButton,
} from '@oppenheimer/design-system-web';
import { ScanIcon, ZoomInIcon, ZoomOutIcon } from '@oppenheimer/design-system-web/icons';
import { useTranslation } from 'react-i18next';
import { usePanZoom } from '../hooks/use-pan-zoom';
import type { DrawnDiagram } from '../lib/diagram';

/**
 * A diagram seen large: fitted to the window on a dotted stage, then zoomed
 * with the wheel, the buttons or a double press, and dragged once zoomed.
 */
export function DiagramDialog({
  diagram,
  open,
  onOpenChange,
}: {
  diagram: DrawnDiagram;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const { view, zoomed, zoomIn, zoomOut, fit, stage } = usePanZoom();
  const name = diagram.title ?? t('common.markdown.diagram.title');
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        size="lg"
        closeLabel={t('common.close')}
        className="h-[calc(100svh-4rem)] max-w-[min(80rem,calc(100vw-4rem))]"
      >
        <DialogHeader className="pt-5 pb-3">
          <DialogTitle>{name}</DialogTitle>
          <DialogDescription>{t('common.markdown.diagram.zoomHint')}</DialogDescription>
        </DialogHeader>
        <div className="relative mx-5 mb-5 min-h-0 flex-1 overflow-hidden rounded-md border border-border-subtle bg-card bg-[radial-gradient(var(--border)_1px,transparent_1px)] bg-size-[18px_18px]">
          {/* Pointer gestures only: the zoom buttons below do the same from the keyboard. */}
          <div
            {...stage}
            role="presentation"
            className={`absolute inset-0 touch-none select-none ${zoomed ? 'cursor-grab active:cursor-grabbing' : 'cursor-zoom-in'}`}
          >
            <img
              src={diagram.src}
              alt={name}
              draggable={false}
              className="size-full object-contain p-8 transition-transform duration-fast ease-out"
              // The view is the pointer's: a transform per gesture.
              style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})` }}
            />
          </div>
          <div className="absolute right-3 bottom-3 flex items-center gap-0.5 rounded-pill border border-border-subtle bg-popover p-0.5 shadow-sm">
            <IconButton
              size="sm"
              aria-label={t('common.markdown.diagram.zoomOut')}
              title={t('common.markdown.diagram.zoomOut')}
              disabled={!zoomed}
              onClick={zoomOut}
            >
              <ZoomOutIcon />
            </IconButton>
            <IconButton
              size="sm"
              aria-label={t('common.markdown.diagram.fit')}
              title={t('common.markdown.diagram.fit')}
              disabled={!zoomed}
              onClick={fit}
            >
              <ScanIcon />
            </IconButton>
            <IconButton
              size="sm"
              aria-label={t('common.markdown.diagram.zoomIn')}
              title={t('common.markdown.diagram.zoomIn')}
              onClick={zoomIn}
            >
              <ZoomInIcon />
            </IconButton>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
