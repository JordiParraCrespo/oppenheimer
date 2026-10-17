import {
  ChipSelectPopup,
  ChipSelectTrigger,
  type ChipSelectTriggerVariant,
  Popover,
  PopoverTrigger,
} from '@oppenheimer/design-system-web';
import { Folder, FolderOpen } from '@oppenheimer/design-system-web/icons';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * The folder chip of New session: the path it names, in mono and already
 * compacted to its last folders (`compactPath`), and a popup whose body the
 * section above draws (`FolderBrowser`) — so the listing is read only while
 * the popup is open. Props in, open state out.
 */
export function FolderSelect({
  label,
  title,
  open,
  onOpenChange,
  variant,
  children,
}: {
  /** The picked folder as shown (`~/…/code/atlas`), or null for none yet. */
  label: string | null;
  /** The whole path, for the pointer. */
  title?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  variant?: ChipSelectTriggerVariant;
  children: ReactNode;
}) {
  const { t } = useTranslation();

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger
        render={
          <ChipSelectTrigger
            icon={open ? <FolderOpen /> : <Folder />}
            open={open}
            variant={variant}
            placeholder={t('sessions.new.folder.placeholder')}
            aria-label={t('sessions.new.folder.label')}
            title={title}
          >
            {label ? (
              <span className="block max-w-56 truncate font-mono text-xs">{label}</span>
            ) : null}
          </ChipSelectTrigger>
        }
      />
      <ChipSelectPopup width={348} maxHeight={420} className="overflow-y-hidden">
        {children}
      </ChipSelectPopup>
    </Popover>
  );
}
