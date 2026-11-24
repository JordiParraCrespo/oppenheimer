import { ApprovalCommand, ApprovalFile, DiffView } from '@oppenheimer/design-system-web';
import type { ChatPendingPermission } from '@oppenheimer/frontend-consumer';
import { HighlightedCode, useTheme } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import { pathParts } from '../lib/chat-blocks';
import { patchOfEdits } from '../lib/file-patch';

/**
 * What a permission asks about, the hero of its card. A command is the
 * command itself, coloured as shell, under the agent's own words for it; an
 * edit or a write is the file and a short diff of what it would put there;
 * anything else (a page to open, a tool of an MCP server) is the tool and
 * what it acts on. Before the transcript names the call, it is what the
 * dialog on screen says.
 */
export function ChatPermissionDetail({ pending }: { pending: ChatPendingPermission }) {
  const { t } = useTranslation();
  const { resolvedTheme } = useTheme();
  const { call, prompt } = pending;

  if (!call) {
    const said = prompt.detail.join('\n');
    return said ? <ApprovalCommand>{said}</ApprovalCommand> : null;
  }

  if (call.kind === 'command' && call.target) {
    return (
      <div className="flex flex-col gap-1.5">
        {call.description ? (
          <p className="m-0 text-[13px] text-fg-muted leading-snug">{call.description}</p>
        ) : null}
        <ApprovalCommand>
          <HighlightedCode code={call.target} language="bash" />
        </ApprovalCommand>
      </div>
    );
  }

  if ((call.kind === 'edit' || call.kind === 'write') && call.target) {
    const { name, folder } = pathParts(call.target);
    const patch = call.edits ? patchOfEdits(call.target, call.edits) : '';
    return (
      <div className="flex flex-col gap-2">
        <ApprovalFile name={name} folder={folder || undefined} />
        {patch ? (
          <div className="max-h-56 overflow-y-auto rounded-sm border border-border-subtle">
            <DiffView patch={patch} colorScheme={resolvedTheme} />
          </div>
        ) : null}
        {call.editsTruncated ? (
          <p className="m-0 text-fg-subtle text-xs">{t('sessions.chat.permission.truncated')}</p>
        ) : null}
      </div>
    );
  }

  return <ApprovalCommand>{call.target ?? call.label}</ApprovalCommand>;
}
