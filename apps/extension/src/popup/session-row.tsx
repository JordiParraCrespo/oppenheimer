import {
  IconButton,
  SessionItem,
  type StatusState,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@oppenheimer/design-system-web';
import { useCopy } from '@oppenheimer/design-system-web/hooks/use-copy';
import { Check, SquareTerminal } from '@oppenheimer/design-system-web/icons';
import { useTranslation } from 'react-i18next';
import { reasonText } from '@/i18n/translator';
import { sessionUrl, teleportCommand } from '@/sessions/links';
import type { TrackedSession } from '@/sessions/session';

/** The design system's run-state word for each of ours: it picks the glyph's colour. */
const RUN_STATE: Record<TrackedSession['state'], StatusState> = {
  'needs-input': 'needs-input',
  failed: 'failed',
  running: 'running',
  done: 'completed',
  stopped: 'paused',
};

/**
 * One session. The row opens it on claude.ai/code; the terminal button
 * copies `claude --teleport <id>`, which brings its branch and conversation
 * into a local checkout.
 */
export function SessionRow({ session, now }: { session: TrackedSession; now: number }) {
  const { t } = useTranslation();
  const command = teleportCommand(session.id);
  const { copied, copy } = useCopy(command);
  const detail = [reasonText(t, session.reason), session.repo].filter(Boolean).join(' · ');

  return (
    <SessionItem
      name={session.title}
      state={RUN_STATE[session.state]}
      status={age(session.updatedAt, now)}
      title={detail || undefined}
      onClick={() => {
        void chrome.tabs.create({ url: sessionUrl(session.id) });
        window.close();
      }}
      action={
        <Tooltip>
          <TooltipTrigger
            render={
              <IconButton
                size="xs"
                shape="square"
                aria-label={t(copied ? 'row.copied' : 'row.copyCommand')}
                onClick={() => void copy()}
              />
            }
          >
            {copied ? <Check /> : <SquareTerminal />}
          </TooltipTrigger>
          <TooltipContent>{copied ? t('row.copied') : command}</TooltipContent>
        </Tooltip>
      }
    />
  );
}

/** "now", "5m", "3h", "2d" — the sidebar's mono age. */
function age(iso: string | null, now: number) {
  if (!iso) return undefined;
  const minutes = Math.floor((now - Date.parse(iso)) / 60_000);
  if (!Number.isFinite(minutes)) return undefined;
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 60 * 24) return `${Math.floor(minutes / 60)}h`;
  return `${Math.floor(minutes / (60 * 24))}d`;
}
