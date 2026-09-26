import {
  DropdownMenu,
  DropdownMenuBack,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPaneItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  IconButton,
} from '@oppenheimer/design-system-web';
import { Ellipsis } from '@oppenheimer/design-system-web/icons';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * A session row's ellipsis: Move to project…, as a second pane of the same
 * menu. Moving is a label change — nothing on the host moves — so it needs no
 * confirmation. Props in, choice out; the sidebar owns the mutation.
 */
export function SessionRowMenu({
  open,
  onOpenChange,
  projects,
  onMove,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Every other project the session could be listed under. */
  projects: { id: string; name: string }[];
  onMove: (projectId: string) => void;
}) {
  const { t } = useTranslation();
  const [pane, setPane] = useState<'root' | 'move'>('root');

  return (
    <DropdownMenu
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) setPane('root');
      }}
    >
      <DropdownMenuTrigger
        render={<IconButton aria-label={t('sessions.row.actions')} size="xs" variant="quiet" />}
      >
        <Ellipsis />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-47.5">
        {pane === 'root' ? (
          <DropdownMenuPaneItem onClick={() => setPane('move')} disabled={projects.length === 0}>
            {t('sessions.row.move')}
          </DropdownMenuPaneItem>
        ) : (
          <>
            <DropdownMenuBack onClick={() => setPane('root')}>
              {t('sessions.row.moveTitle')}
            </DropdownMenuBack>
            <DropdownMenuSeparator />
            {projects.map((project) => (
              <DropdownMenuItem key={project.id} onClick={() => onMove(project.id)}>
                {project.name}
              </DropdownMenuItem>
            ))}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
