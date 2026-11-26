import {
  IconButton,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@oppenheimer/design-system-web';
import { useCopy } from '@oppenheimer/design-system-web/hooks/use-copy';
import { Check, SquareTerminal } from '@oppenheimer/design-system-web/icons';
import { useTranslation } from 'react-i18next';
import { teleportCommand } from '@/sessions/links';

/**
 * A row's terminal button: copies `claude --teleport <id>`, which brings the
 * session's branch and conversation into a local checkout.
 */
export function TeleportButton({ sessionId }: { sessionId: string }) {
  const { t } = useTranslation();
  const command = teleportCommand(sessionId);
  const { copied, copy } = useCopy(command);
  return (
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
  );
}
