'use client';

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@oppenheimer/design-system-web/command';
import { IconButton } from '@oppenheimer/design-system-web/icon-button';
import { Kbd } from '@oppenheimer/design-system-web/kbd';
import { useSidebar } from '@oppenheimer/design-system-web/sidebar';
import { MoonIcon, PanelLeftIcon, SearchIcon, SunIcon } from 'lucide-react';
import * as React from 'react';
import { TOC } from '@/lib/toc';

/**
 * The 56px top bar: sidebar toggle, the ⌘K search pill centred, the theme
 * toggle on the right. Hairline underneath, on the canvas.
 */
export function TopBar() {
  const { toggleSidebar } = useSidebar();
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key.toLowerCase() === 'k' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((value) => !value);
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <header className="relative flex h-(--topbar-h) shrink-0 items-center gap-3 border-b border-border-subtle bg-canvas px-4 sm:gap-5 sm:px-5">
      <IconButton aria-label="Toggle sidebar" size="sm" onClick={toggleSidebar}>
        <PanelLeftIcon />
      </IconButton>

      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-(--control-h-md) min-w-0 flex-1 items-center gap-2.5 rounded-pill border border-field-border bg-field px-3.5 text-operate transition-colors duration-fast hover:border-border-strong sm:absolute sm:left-1/2 sm:w-[380px] sm:max-w-[38vw] sm:flex-none sm:-translate-x-1/2"
      >
        <SearchIcon className="size-4 shrink-0 text-fg-subtle" />
        <span className="flex-1 text-left text-field-placeholder">Search the system</span>
        <Kbd className="hidden shrink-0 sm:inline-flex">⌘K</Kbd>
      </button>

      <div className="ml-auto flex items-center gap-2">
        <ThemeButton />
      </div>

      <SearchPalette open={open} onOpenChange={setOpen} />
    </header>
  );
}

function ThemeButton() {
  const [isDark, setIsDark] = React.useState(false);

  React.useEffect(() => {
    setIsDark(document.documentElement.classList.contains('dark'));
  }, []);

  function toggle() {
    const next = !document.documentElement.classList.contains('dark');
    document.documentElement.classList.toggle('dark', next);
    localStorage.setItem('theme', next ? 'dark' : 'light');
    setIsDark(next);
  }

  return (
    <IconButton aria-label="Toggle theme" size="sm" onClick={toggle}>
      {isDark ? <SunIcon /> : <MoonIcon />}
    </IconButton>
  );
}

function SearchPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  function go(id: string) {
    onOpenChange(false);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Jump to a section…" />
      <CommandList>
        <CommandEmpty>Nothing matches.</CommandEmpty>
        {TOC.map((section) => (
          <CommandGroup key={section.group} heading={section.group}>
            {section.items.map((item) => (
              <CommandItem
                key={item.id}
                value={`${section.group} ${item.label}`}
                onSelect={() => go(item.id)}
              >
                <item.icon />
                <span>{item.label}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        ))}
      </CommandList>
    </CommandDialog>
  );
}
