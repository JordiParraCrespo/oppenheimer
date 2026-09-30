'use client';

import { Alert, AlertDescription, AlertTitle } from '@oppenheimer/design-system-web/alert';
import { Badge } from '@oppenheimer/design-system-web/badge';
import { Button } from '@oppenheimer/design-system-web/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandItemIcon,
  CommandList,
  CommandShortcut,
} from '@oppenheimer/design-system-web/command';
import { FolderKanbanIcon, PlusIcon, TerminalIcon } from '@oppenheimer/design-system-web/icons';
import { Skeleton } from '@oppenheimer/design-system-web/skeleton';
import { Toaster, toast } from '@oppenheimer/design-system-web/sonner';
import { Swatch } from './page-shell';

export function AlertDemo() {
  return (
    <div className="grid w-full max-w-lg gap-3">
      <Alert tone="danger">
        <AlertTitle>Could not sign in</AlertTitle>
        <AlertDescription>The email or password is wrong.</AlertDescription>
      </Alert>
      <Alert tone="warning">
        <AlertTitle>Host offline</AlertTitle>
        <AlertDescription>The runner has not reported for five minutes.</AlertDescription>
      </Alert>
    </div>
  );
}

export function BadgeDemo() {
  return (
    <>
      <Swatch label="active">
        <Badge variant="active">Active</Badge>
      </Swatch>
      <Swatch label="paused">
        <Badge variant="paused">Paused</Badge>
      </Swatch>
      <Swatch label="ended">
        <Badge variant="ended">Ended</Badge>
      </Swatch>
      <Swatch label="draft">
        <Badge variant="draft">Draft</Badge>
      </Swatch>
      <Swatch label="neutral">
        <Badge variant="neutral">Owner</Badge>
      </Swatch>
    </>
  );
}

export function SkeletonDemo() {
  return (
    <div className="grid w-full max-w-sm gap-2">
      <Skeleton shape="pill" className="size-7" />
      <Skeleton className="h-4 w-2/3" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-1/2" />
    </div>
  );
}

export function ToastDemo() {
  return (
    <>
      <Button variant="outline" onClick={() => toast.success('Host renamed')}>
        Show a toast
      </Button>
      <Toaster />
    </>
  );
}

export function CommandDemo() {
  return (
    <Command className="max-w-md">
      <CommandInput placeholder="Search sessions and actions" />
      <CommandList>
        <CommandEmpty>Nothing matches.</CommandEmpty>
        <CommandGroup heading="Actions">
          <CommandItem>
            <CommandItemIcon>
              <PlusIcon />
            </CommandItemIcon>
            New session
            <CommandShortcut>⌘N</CommandShortcut>
          </CommandItem>
          <CommandItem>
            <CommandItemIcon>
              <FolderKanbanIcon />
            </CommandItemIcon>
            New project
          </CommandItem>
        </CommandGroup>
        <CommandGroup heading="Sessions">
          <CommandItem>
            <CommandItemIcon>
              <TerminalIcon />
            </CommandItemIcon>
            Fix the flaky upload test
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </Command>
  );
}
