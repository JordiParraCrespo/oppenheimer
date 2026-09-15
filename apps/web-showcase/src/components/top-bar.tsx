"use client";

import { Kbd } from "@oppenheimer/design-system-web/kbd";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@oppenheimer/design-system-web/command";
import { useSidebar } from "@oppenheimer/design-system-web/sidebar";
import {
  MenuIcon,
  MoonIcon,
  SearchIcon,
  SunIcon,
} from "lucide-react";
import * as React from "react";
import { TOC } from "@/lib/toc";

/**
 * The product topbar: 56px tall, hairline underneath, chrome background.
 * Sidebar toggle on the left, the ⌘K search trigger centred, and the utility
 * cluster on the right — Ask AI, theme, notifications, avatar.
 */
export function TopBar() {
  const { toggleSidebar } = useSidebar();
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((value) => !value);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <header className="relative flex h-14 shrink-0 items-center gap-3 border-b border-border-subtle bg-popover px-4 sm:gap-5 sm:px-5">
      <IconButton label="Toggle sidebar" onClick={toggleSidebar}>
        <MenuIcon className="size-4.5" />
      </IconButton>

      {/* From sm up the pill is absolutely centred, not `flex-1` centred:
          otherwise it drifts with the width of the utility cluster beside it.
          Below that there is no room to centre anything, so it just flexes. */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-9 min-w-0 flex-1 items-center gap-2.5 rounded-full border border-border-default bg-card px-3 transition-colors hover:border-border-strong hover:bg-surface-hover sm:absolute sm:left-1/2 sm:w-[380px] sm:max-w-[38vw] sm:flex-none sm:-translate-x-1/2"
      >
        <SearchIcon className="size-4 shrink-0 text-ink-400" />
        <span className="flex-1 text-left text-base text-ink-400">Search</span>
        <Kbd className="hidden shrink-0 sm:inline-flex">⌘K</Kbd>
      </button>

      <div className="ml-auto flex items-center gap-2">
        <ThemeButton />
      </div>

      <SearchPalette open={open} onOpenChange={setOpen} />
    </header>
  );
}

/** The topbar's 34px round hover-tint icon button. */
function IconButton({
  label,
  children,
  ...props
}: React.ComponentProps<"button"> & { label: string }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      className="inline-flex size-8.5 shrink-0 items-center justify-center rounded-full text-ink-600 transition-colors hover:bg-surface-hover hover:text-ink-900"
      {...props}
    >
      {children}
    </button>
  );
}

function ThemeButton() {
  const [isDark, setIsDark] = React.useState(false);

  React.useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggle() {
    const next = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
    setIsDark(next);
  }

  return (
    <IconButton label="Toggle theme" onClick={toggle}>
      {isDark ? (
        <SunIcon className="size-4" />
      ) : (
        <MoonIcon className="size-4" />
      )}
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
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Search or jump to..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
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
