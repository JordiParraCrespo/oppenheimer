import {
  Button,
  cn,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Skeleton,
} from '@oppenheimer/design-system-web';
import { Code2 } from '@oppenheimer/design-system-web/icons';
import { useDeploymentCapabilities, useFeatureFlag } from '@oppenheimer/frontend-core/react';
import type { VisualBlock } from '@oppenheimer/shared/schemas/visual';
import { useTranslation } from 'react-i18next';
import { useVisualFrame } from '../hooks/use-visual-frame';
import { VisualBlockTitle } from './visual-block-title';

type Html = Extract<VisualBlock, { type: 'html' }>;

/** The block's source, folded, where the console does not run it. */
function HtmlSource({ block, reason }: { block: Html; reason: string }) {
  const { t } = useTranslation();
  return (
    <div className="flex min-w-0 flex-col gap-2">
      {block.title ? <VisualBlockTitle>{block.title}</VisualBlockTitle> : null}
      <details className="group/source rounded-xl border border-dashed border-border-default px-3.5 py-2.5 text-xs text-fg-muted">
        <summary className="flex cursor-pointer list-none items-center gap-2 select-none">
          <Code2 aria-hidden className="size-3.5" />
          {reason}
          <span className="ml-auto text-fg-subtle group-open/source:hidden">
            {t('common.visual.html.showSource')}
          </span>
        </summary>
        <pre className="mt-2 mb-0 max-h-80 overflow-auto font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-fg">
          {block.html}
        </pre>
      </details>
    </div>
  );
}

/**
 * HTML the agent wrote, in a frame on the deployment's visuals origin with
 * `sandbox="allow-scripts"`: an origin of its own, no storage, no popups, no
 * navigation of the console, and the page's CSP closing the network. The
 * console posts the fragment and its theme in (again whenever the theme
 * changes) and takes three messages back, from that frame alone: its height,
 * an error, and a link, which opens only once the reader says so.
 */
function VisualHtmlFrame({ block, url }: { block: Html; url: string }) {
  const { t } = useTranslation();
  const { frame, height, state, error, link, closeLink } = useVisualFrame(
    block.html,
    block.height ?? 220,
  );

  if (state === 'failed')
    return <HtmlSource block={block} reason={t('common.visual.html.didNotLoad')} />;
  let host = '';
  try {
    host = link ? new URL(link).host : '';
  } catch {
    host = '';
  }
  return (
    <div className="flex min-w-0 flex-col gap-2">
      {block.title ? <VisualBlockTitle>{block.title}</VisualBlockTitle> : null}
      <div className="relative min-w-0">
        {state === 'loading' ? (
          <Skeleton className="absolute inset-0 rounded-xl" style={{ height }} />
        ) : null}
        <iframe
          ref={frame}
          src={url}
          title={block.title ?? t('common.visual.html.frameTitle')}
          sandbox="allow-scripts"
          referrerPolicy="no-referrer"
          loading="lazy"
          className={cn(
            'block w-full border-0 bg-transparent transition-[opacity,height] duration-base ease-out',
            state === 'loading' ? 'opacity-0' : 'opacity-100',
          )}
          style={{ height }}
        />
      </div>
      {error ? (
        <p role="status" className="m-0 font-mono text-[11px] text-danger">
          {t('common.visual.html.failedInside', { message: error })}
        </p>
      ) : null}
      <Dialog open={link !== null} onOpenChange={(open) => (open ? null : closeLink())}>
        <DialogContent closeLabel={t('common.close')}>
          <DialogHeader>
            <DialogTitle>{t('common.visual.html.openLinkTitle')}</DialogTitle>
            <DialogDescription>{t('common.visual.html.openLinkBody', { host })}</DialogDescription>
          </DialogHeader>
          <DialogBody>
            <p className="m-0 font-mono text-xs break-all text-fg-muted">{link}</p>
          </DialogBody>
          <DialogFooter>
            <Button variant="ghost" onClick={closeLink}>
              {t('common.cancel')}
            </Button>
            <Button
              onClick={() => {
                if (link) window.open(link, '_blank', 'noopener,noreferrer');
                closeLink();
              }}
            >
              {t('common.visual.html.openLink')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/**
 * An `html` block: run in its frame where the deployment has a visuals origin
 * and the workspace keeps `visual_html` on, and shown as its source, folded,
 * everywhere else.
 */
export function VisualHtml({ block }: { block: Html }) {
  const { t } = useTranslation();
  const enabled = useFeatureFlag('visual_html');
  const url = useDeploymentCapabilities({ select: (deployment) => deployment.visual_frame_url });
  if (url.isPending) {
    return (
      <>
        {/* A block stands in here: the frame's own space, at the height the page will first take. */}
        <Skeleton className="w-full rounded-xl" style={{ height: block.height ?? 220 }} />
      </>
    );
  }
  if (!enabled || !url.data)
    return <HtmlSource block={block} reason={t('common.visual.html.notRun')} />;
  return <VisualHtmlFrame block={block} url={url.data} />;
}
