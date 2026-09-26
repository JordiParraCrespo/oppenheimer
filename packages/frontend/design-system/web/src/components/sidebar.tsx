'use client';

import { mergeProps } from '@base-ui/react/merge-props';
import { useRender } from '@base-ui/react/use-render';
import { cva, type VariantProps } from 'class-variance-authority';
import { ChevronDownIcon, PanelLeftIcon, SearchIcon, XIcon } from 'lucide-react';
import * as React from 'react';
import { useControlled } from '../hooks/use-controlled';
import { useIsMobile } from '../hooks/use-mobile';
import { cn } from '../lib/utils';
import { Button } from './button';
import { Input } from './input';
import { Separator } from './separator';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from './sheet';
import { Skeleton } from './skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from './tooltip';

const SIDEBAR_COOKIE_NAME = 'sidebar_state';
const SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 7;
const SIDEBAR_WIDTH = '16.5rem'; // 264px — the system's rail width

const SIDEBAR_WIDTH_MOBILE = '18rem';
const SIDEBAR_WIDTH_ICON = '3.75rem'; // 60px collapsed
const SIDEBAR_KEYBOARD_SHORTCUT = 'b';

type SidebarContextProps = {
  state: 'expanded' | 'collapsed';
  open: boolean;
  setOpen: (open: boolean) => void;
  openMobile: boolean;
  setOpenMobile: (open: boolean) => void;
  isMobile: boolean;
  toggleSidebar: () => void;
};

const SidebarContext = React.createContext<SidebarContextProps | null>(null);

function useSidebar() {
  const context = React.useContext(SidebarContext);
  if (!context) {
    throw new Error('useSidebar must be used within a SidebarProvider.');
  }

  return context;
}

function SidebarProvider({
  defaultOpen = true,
  open: openProp,
  onOpenChange: setOpenProp,
  className,
  style,
  children,
  ...props
}: React.ComponentProps<'div'> & {
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const isMobile = useIsMobile();
  const [openMobile, setOpenMobile] = React.useState(false);

  // The sidebar's own state until the caller passes `open`, and the cookie
  // that keeps it between visits either way.
  const onOpenChange = React.useCallback(
    (openState: boolean) => {
      setOpenProp?.(openState);
      document.cookie = `${SIDEBAR_COOKIE_NAME}=${openState}; path=/; max-age=${SIDEBAR_COOKIE_MAX_AGE}`;
    },
    [setOpenProp],
  );
  const [open, setOpen] = useControlled({
    value: openProp,
    defaultValue: defaultOpen,
    onChange: onOpenChange,
  });

  // Helper to toggle the sidebar.
  const toggleSidebar = React.useCallback(() => {
    return isMobile ? setOpenMobile((open) => !open) : setOpen((open) => !open);
  }, [isMobile, setOpen, setOpenMobile]);

  // Adds a keyboard shortcut to toggle the sidebar.
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === SIDEBAR_KEYBOARD_SHORTCUT && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        toggleSidebar();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleSidebar]);

  // We add a state so that we can do data-state="expanded" or "collapsed".
  // This makes it easier to style the sidebar with Tailwind classes.
  const state = open ? 'expanded' : 'collapsed';

  const contextValue = React.useMemo<SidebarContextProps>(
    () => ({
      state,
      open,
      setOpen,
      isMobile,
      openMobile,
      setOpenMobile,
      toggleSidebar,
    }),
    [state, open, setOpen, isMobile, openMobile, setOpenMobile, toggleSidebar],
  );

  return (
    <SidebarContext.Provider value={contextValue}>
      <div
        data-slot="sidebar-wrapper"
        style={
          {
            '--sidebar-width': SIDEBAR_WIDTH,
            '--sidebar-width-icon': SIDEBAR_WIDTH_ICON,
            ...style,
          } as React.CSSProperties
        }
        className={cn(
          'group/sidebar-wrapper flex min-h-svh w-full has-data-[variant=inset]:bg-sidebar',
          className,
        )}
        {...props}
      >
        {children}
      </div>
    </SidebarContext.Provider>
  );
}

function Sidebar({
  side = 'left',
  variant = 'sidebar',
  collapsible = 'offcanvas',
  className,
  children,
  dir,
  ...props
}: React.ComponentProps<'div'> & {
  side?: 'left' | 'right';
  variant?: 'sidebar' | 'floating' | 'inset';
  collapsible?: 'offcanvas' | 'icon' | 'none';
}) {
  const { isMobile, state, openMobile, setOpenMobile } = useSidebar();

  if (collapsible === 'none') {
    return (
      <div
        data-slot="sidebar"
        className={cn(
          'flex h-full w-(--sidebar-width) flex-col bg-sidebar text-sidebar-foreground',
          className,
        )}
        {...props}
      >
        {children}
      </div>
    );
  }

  if (isMobile) {
    return (
      <Sheet open={openMobile} onOpenChange={setOpenMobile} {...props}>
        <SheetContent
          dir={dir}
          data-sidebar="sidebar"
          data-slot="sidebar"
          data-mobile="true"
          className="w-(--sidebar-width) bg-sidebar p-0 text-sidebar-foreground [&>button]:hidden"
          style={
            {
              '--sidebar-width': SIDEBAR_WIDTH_MOBILE,
            } as React.CSSProperties
          }
          side={side}
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Sidebar</SheetTitle>
            <SheetDescription>Displays the mobile sidebar.</SheetDescription>
          </SheetHeader>
          <div className="flex h-full w-full flex-col">{children}</div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <div
      className="group peer hidden text-sidebar-foreground md:block"
      data-state={state}
      data-collapsible={state === 'collapsed' ? collapsible : ''}
      data-variant={variant}
      data-side={side}
      data-slot="sidebar"
    >
      {/* This is what handles the sidebar gap on desktop */}
      <div
        data-slot="sidebar-gap"
        className={cn(
          'relative w-(--sidebar-width) bg-transparent transition-[width] duration-base ease-standard',
          'group-data-[collapsible=offcanvas]:w-0',
          'group-data-[side=right]:rotate-180',
          variant === 'floating' || variant === 'inset'
            ? 'group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)+(--spacing(4)))]'
            : 'group-data-[collapsible=icon]:w-(--sidebar-width-icon)',
        )}
      />
      <div
        data-slot="sidebar-container"
        data-side={side}
        className={cn(
          'fixed inset-y-0 z-10 hidden h-svh w-(--sidebar-width) transition-[left,right,width] duration-base ease-standard data-[side=left]:left-0 data-[side=left]:group-data-[collapsible=offcanvas]:left-[calc(var(--sidebar-width)*-1)] data-[side=right]:right-0 data-[side=right]:group-data-[collapsible=offcanvas]:right-[calc(var(--sidebar-width)*-1)] md:flex',
          // Adjust the padding for floating and inset variants.
          variant === 'floating' || variant === 'inset'
            ? 'p-2 group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)+(--spacing(4))+2px)]'
            : 'group-data-[collapsible=icon]:w-(--sidebar-width-icon) group-data-[side=left]:border-r group-data-[side=left]:border-sidebar-border group-data-[side=right]:border-l group-data-[side=right]:border-sidebar-border',
          className,
        )}
        {...props}
      >
        <div
          data-sidebar="sidebar"
          data-slot="sidebar-inner"
          className="glass-rail flex size-full flex-col text-sidebar-foreground group-data-[variant=floating]:rounded-lg group-data-[variant=floating]:ring-1 group-data-[variant=floating]:ring-sidebar-border"
        >
          {children}
        </div>
      </div>
    </div>
  );
}

function SidebarTrigger({ className, onClick, ...props }: React.ComponentProps<typeof Button>) {
  const { toggleSidebar } = useSidebar();

  return (
    <Button
      data-sidebar="trigger"
      data-slot="sidebar-trigger"
      variant="ghost"
      size="icon-sm"
      className={cn('text-fg-muted', className)}
      onClick={(event) => {
        onClick?.(event);
        toggleSidebar();
      }}
      {...props}
    >
      <PanelLeftIcon className="cn-rtl-flip" />
      <span className="sr-only">Toggle Sidebar</span>
    </Button>
  );
}

function SidebarRail({ className, ...props }: React.ComponentProps<'button'>) {
  const { toggleSidebar } = useSidebar();

  return (
    <button
      data-sidebar="rail"
      data-slot="sidebar-rail"
      aria-label="Toggle Sidebar"
      tabIndex={-1}
      onClick={toggleSidebar}
      title="Toggle Sidebar"
      className={cn(
        'absolute inset-y-0 z-20 hidden w-4 transition-all ease-linear group-data-[side=left]:-right-4 group-data-[side=right]:left-0 after:absolute after:inset-y-0 after:start-1/2 after:w-0.5 hover:after:bg-sidebar-border sm:flex ltr:-translate-x-1/2 rtl:-translate-x-1/2',
        'in-data-[side=left]:cursor-w-resize in-data-[side=right]:cursor-e-resize',
        '[[data-side=left][data-state=collapsed]_&]:cursor-e-resize [[data-side=right][data-state=collapsed]_&]:cursor-w-resize',
        'group-data-[collapsible=offcanvas]:translate-x-0 group-data-[collapsible=offcanvas]:after:left-full hover:group-data-[collapsible=offcanvas]:bg-sidebar',
        '[[data-side=left][data-collapsible=offcanvas]_&]:-right-2',
        '[[data-side=right][data-collapsible=offcanvas]_&]:-left-2',
        className,
      )}
      {...props}
    />
  );
}

function SidebarInset({ className, ...props }: React.ComponentProps<'main'>) {
  return (
    <main
      data-slot="sidebar-inset"
      className={cn(
        'relative flex w-full flex-1 flex-col bg-background md:peer-data-[variant=inset]:m-2 md:peer-data-[variant=inset]:ml-0 md:peer-data-[variant=inset]:rounded-2xl md:peer-data-[variant=inset]:shadow-sm md:peer-data-[variant=inset]:peer-data-[state=collapsed]:ml-2',
        className,
      )}
      {...props}
    />
  );
}

function SidebarInput({ className, ...props }: React.ComponentProps<typeof Input>) {
  return (
    <Input
      data-slot="sidebar-input"
      data-sidebar="input"
      className={cn('h-8 w-full bg-card shadow-none', className)}
      {...props}
    />
  );
}

/**
 * SidebarSearch — the 30px field under the list header: the hover fill at
 * rest, a 10px radius, the search glyph, and a round clear button once
 * there is a query. Focus lifts it onto the card surface with the ring.
 * Controlled: the list it narrows reads the settled `value`.
 */
function SidebarSearch({
  value,
  onValueChange,
  clearLabel = 'Clear search',
  className,
  ...props
}: Omit<React.ComponentProps<'input'>, 'value' | 'onChange'> & {
  value: string;
  onValueChange: (value: string) => void;
  clearLabel?: string;
}) {
  return (
    <div
      data-slot="sidebar-search"
      data-on={value ? '' : undefined}
      className={cn(
        'mx-3 mb-2 flex h-[30px] items-center gap-2 rounded-sm bg-hover-surface pr-1.5 pl-2.5 text-fg-subtle transition-[background-color,box-shadow] duration-fast ease-standard focus-within:bg-card focus-within:ring-3 focus-within:ring-ring focus-within:outline-1 focus-within:outline-primary',
        className,
      )}
    >
      <SearchIcon className="size-3.5 shrink-0" aria-hidden />
      <input
        type="text"
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        className="min-w-0 flex-1 bg-transparent text-[13.5px] text-fg outline-none placeholder:text-fg-subtle"
        {...props}
      />
      {value ? (
        <button
          type="button"
          aria-label={clearLabel}
          onClick={() => onValueChange('')}
          className="flex size-5 shrink-0 items-center justify-center rounded-pill text-fg-subtle transition-colors duration-fast hover:bg-hover-surface hover:text-fg"
        >
          <XIcon className="size-3" />
        </button>
      ) : null}
    </div>
  );
}

/**
 * SidebarProjectHeader — a project's row in the grouped list: a chevron
 * that folds the group, the name, a mono count, and actions (new session,
 * project settings) that only appear on hover or focus. 28px on a 6px
 * radius, the hover wash across the whole row. `current` lifts the name to
 * full ink while a session inside the group is open.
 */
function SidebarProjectHeader({
  name,
  count,
  open = true,
  onOpenChange,
  current,
  actions,
  className,
  ...props
}: Omit<React.ComponentProps<'div'>, 'children'> & {
  name: React.ReactNode;
  count?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  current?: boolean;
  /** Icon buttons, 22px, shown on hover. */
  actions?: React.ReactNode;
}) {
  return (
    <div
      data-slot="sidebar-project-header"
      data-open={open}
      data-current={current || undefined}
      className={cn(
        'group/project relative mx-1.5 flex h-7 items-center gap-0.5 rounded-xs pr-1 pl-1.5 transition-colors duration-fast hover:bg-hover-surface',
        className,
      )}
      {...props}
    >
      <button
        type="button"
        aria-expanded={open}
        onClick={() => onOpenChange?.(!open)}
        className="flex h-full min-w-0 flex-1 items-center gap-1.5 text-left text-[12.5px] font-medium tracking-[-0.006em] text-sidebar-muted outline-none transition-colors duration-fast hover:text-fg group-data-current/project:text-fg focus-visible:text-fg"
      >
        <ChevronDownIcon
          className={cn(
            'size-3.5 shrink-0 transition-transform duration-base ease-standard',
            !open && '-rotate-90',
          )}
          aria-hidden
        />
        <span className="truncate">{name}</span>
        {count !== undefined ? (
          <span className="figures ml-0.5 text-[11px] font-normal text-fg-subtle">{count}</span>
        ) : null}
      </button>
      {actions ? (
        <span className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity duration-fast group-hover/project:opacity-100 group-focus-within/project:opacity-100 [&_button]:size-[22px] [&_button]:rounded-xs [&_button]:text-sidebar-muted [&_button:hover]:text-fg [&_svg:not([class*=size-])]:size-3.5">
          {actions}
        </span>
      ) : null}
    </div>
  );
}

/** The one-line note inside an empty group: "No sessions yet. Start one". */
function SidebarEmptyRow({ className, ...props }: React.ComponentProps<'p'>) {
  return (
    <p
      data-slot="sidebar-empty-row"
      className={cn(
        'mx-3.5 mt-0.5 mb-2 ml-8 text-xs leading-snug text-fg-subtle [&_a]:text-link [&_button]:text-link',
        className,
      )}
      {...props}
    />
  );
}

function SidebarHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="sidebar-header"
      data-sidebar="header"
      className={cn('flex flex-col gap-2 px-3 pt-3.5 pb-2', className)}
      {...props}
    />
  );
}

function SidebarFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="sidebar-footer"
      data-sidebar="footer"
      className={cn('mt-auto flex flex-col gap-2 border-t border-sidebar-border px-3 py-2.5', className)}
      {...props}
    />
  );
}

function SidebarSeparator({ className, ...props }: React.ComponentProps<typeof Separator>) {
  return (
    <Separator
      data-slot="sidebar-separator"
      data-sidebar="separator"
      className={cn('mx-2 w-auto bg-sidebar-border', className)}
      {...props}
    />
  );
}

function SidebarContent({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="sidebar-content"
      data-sidebar="content"
      className={cn(
        'no-scrollbar flex min-h-0 flex-1 flex-col gap-2 overflow-auto group-data-[collapsible=icon]:overflow-hidden',
        className,
      )}
      {...props}
    />
  );
}

function SidebarGroup({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="sidebar-group"
      data-sidebar="group"
      className={cn('relative flex w-full min-w-0 flex-col px-3 py-0', className)}
      {...props}
    />
  );
}

function SidebarGroupLabel({
  className,
  render,
  ...props
}: useRender.ComponentProps<'div'> & React.ComponentProps<'div'>) {
  return useRender({
    defaultTagName: 'div',
    props: mergeProps<'div'>(
      {
        className: cn(
          'flex h-[26px] shrink-0 items-center gap-2 px-2.5 text-micro font-medium tracking-wide uppercase text-sidebar-muted outline-hidden transition-[margin,opacity] duration-base ease-standard group-data-[collapsible=icon]:-mt-8 group-data-[collapsible=icon]:opacity-0 [&>svg]:size-4 [&>svg]:shrink-0 *:[[data-slot=sidebar-group-count]]:ml-auto',
          className,
        ),
      },
      props,
    ),
    render,
    state: {
      slot: 'sidebar-group-label',
      sidebar: 'group-label',
    },
  });
}

/** The mono count beside a group label ("SESSIONS 9"). */
function SidebarGroupCount({ className, ...props }: React.ComponentProps<'span'>) {
  return (
    <span
      data-slot="sidebar-group-count"
      className={cn('figures text-[11px] normal-case tracking-normal text-sidebar-muted', className)}
      {...props}
    />
  );
}

function SidebarGroupAction({
  className,
  render,
  ...props
}: useRender.ComponentProps<'button'> & React.ComponentProps<'button'>) {
  return useRender({
    defaultTagName: 'button',
    props: mergeProps<'button'>(
      {
        className: cn(
          'absolute top-px right-3 flex size-6 items-center justify-center rounded-sm p-0 text-fg-subtle outline-hidden transition-colors duration-fast group-data-[collapsible=icon]:hidden after:absolute after:-inset-2 hover:bg-hover-surface hover:text-fg aria-expanded:bg-active-surface aria-expanded:text-fg data-dirty:bg-active-surface data-dirty:text-fg md:after:hidden [&>svg]:size-3.5 [&>svg]:shrink-0',
          className,
        ),
      },
      props,
    ),
    render,
    state: {
      slot: 'sidebar-group-action',
      sidebar: 'group-action',
    },
  });
}

function SidebarGroupContent({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="sidebar-group-content"
      data-sidebar="group-content"
      className={cn('w-full text-sm', className)}
      {...props}
    />
  );
}

function SidebarMenu({ className, ...props }: React.ComponentProps<'ul'>) {
  return (
    <ul
      data-slot="sidebar-menu"
      data-sidebar="menu"
      className={cn('flex w-full min-w-0 flex-col gap-px', className)}
      {...props}
    />
  );
}

function SidebarMenuItem({ className, ...props }: React.ComponentProps<'li'>) {
  return (
    <li
      data-slot="sidebar-menu-item"
      data-sidebar="menu-item"
      className={cn('group/menu-item relative', className)}
      {...props}
    />
  );
}

const sidebarMenuButtonVariants = cva(
  'peer/menu-button group/menu-button flex w-full items-center gap-2.5 overflow-hidden rounded-sm px-2.5 text-left text-operate text-sidebar-foreground outline-hidden transition-[width,height,padding,background-color,color] duration-instant group-has-data-[sidebar=menu-action]/menu-item:pr-8 group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:p-2! hover:bg-sidebar-item-hover disabled:pointer-events-none disabled:opacity-40 aria-disabled:pointer-events-none aria-disabled:opacity-40 data-open:bg-sidebar-item-hover data-active:bg-sidebar-item-active data-active:font-medium [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-sidebar-muted data-active:[&_svg]:text-fg [&>span:last-child]:truncate focus-visible:outline-2 focus-visible:outline-ring',
  {
    variants: {
      variant: {
        default: '',
        outline: 'border border-sidebar-border bg-background hover:bg-sidebar-item-hover',
      },
      size: {
        default: 'h-8',
        sm: 'h-[30px] text-sm',
        lg: 'h-12 px-2 group-data-[collapsible=icon]:p-0!',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

function SidebarMenuButton({
  render,
  isActive = false,
  variant = 'default',
  size = 'default',
  tooltip,
  className,
  ...props
}: useRender.ComponentProps<'button'> &
  React.ComponentProps<'button'> & {
    isActive?: boolean;
    tooltip?: string | React.ComponentProps<typeof TooltipContent>;
  } & VariantProps<typeof sidebarMenuButtonVariants>) {
  const { isMobile, state } = useSidebar();
  const comp = useRender({
    defaultTagName: 'button',
    props: mergeProps<'button'>(
      {
        className: cn(sidebarMenuButtonVariants({ variant, size }), className),
      },
      props,
    ),
    render: !tooltip ? render : <TooltipTrigger render={render} />,
    state: {
      slot: 'sidebar-menu-button',
      sidebar: 'menu-button',
      size,
      active: isActive,
    },
  });

  if (!tooltip) {
    return comp;
  }

  if (typeof tooltip === 'string') {
    tooltip = {
      children: tooltip,
    };
  }

  return (
    <Tooltip>
      {comp}
      <TooltipContent
        side="right"
        align="center"
        hidden={state !== 'collapsed' || isMobile}
        {...tooltip}
      />
    </Tooltip>
  );
}

function SidebarMenuAction({
  className,
  render,
  showOnHover = false,
  ...props
}: useRender.ComponentProps<'button'> &
  React.ComponentProps<'button'> & {
    showOnHover?: boolean;
  }) {
  return useRender({
    defaultTagName: 'button',
    props: mergeProps<'button'>(
      {
        className: cn(
          'absolute top-1.5 right-1 flex aspect-square w-5 items-center justify-center rounded-md p-0 text-sidebar-foreground ring-sidebar-ring outline-hidden transition-transform group-data-[collapsible=icon]:hidden peer-hover/menu-button:text-sidebar-accent-foreground peer-data-[size=default]/menu-button:top-2 peer-data-[size=lg]/menu-button:top-2.5 peer-data-[size=sm]/menu-button:top-1 after:absolute after:-inset-2 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground md:after:hidden [&>svg]:size-4 [&>svg]:shrink-0',
          showOnHover &&
            'group-focus-within/menu-item:opacity-100 group-hover/menu-item:opacity-100 peer-data-active/menu-button:text-sidebar-accent-foreground aria-expanded:opacity-100 md:opacity-0',
          className,
        ),
      },
      props,
    ),
    render,
    state: {
      slot: 'sidebar-menu-action',
      sidebar: 'menu-action',
    },
  });
}

function SidebarMenuBadge({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="sidebar-menu-badge"
      data-sidebar="menu-badge"
      className={cn(
        'pointer-events-none absolute right-2.5 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-accent-blue px-1.5 text-xs font-medium text-white tabular-nums select-none group-data-[collapsible=icon]:hidden peer-data-[size=default]/menu-button:top-2 peer-data-[size=lg]/menu-button:top-4 peer-data-[size=sm]/menu-button:top-2',
        className,
      )}
      {...props}
    />
  );
}

function SidebarMenuSkeleton({
  className,
  showIcon = false,
  ...props
}: React.ComponentProps<'div'> & {
  showIcon?: boolean;
}) {
  // Random width between 50 to 90%.
  const [width] = React.useState(() => {
    return `${Math.floor(Math.random() * 40) + 50}%`;
  });

  return (
    <div
      data-slot="sidebar-menu-skeleton"
      data-sidebar="menu-skeleton"
      className={cn('flex h-8 items-center gap-2 rounded-md px-2', className)}
      {...props}
    >
      {showIcon && <Skeleton className="size-4 rounded-md" data-sidebar="menu-skeleton-icon" />}
      <Skeleton
        className="h-4 max-w-(--skeleton-width) flex-1"
        data-sidebar="menu-skeleton-text"
        style={
          {
            '--skeleton-width': width,
          } as React.CSSProperties
        }
      />
    </div>
  );
}

function SidebarMenuSub({ className, ...props }: React.ComponentProps<'ul'>) {
  return (
    <ul
      data-slot="sidebar-menu-sub"
      data-sidebar="menu-sub"
      className={cn(
        'mx-3.5 flex min-w-0 translate-x-px flex-col gap-1 border-l border-sidebar-border px-2.5 py-0.5 group-data-[collapsible=icon]:hidden',
        className,
      )}
      {...props}
    />
  );
}

function SidebarMenuSubItem({ className, ...props }: React.ComponentProps<'li'>) {
  return (
    <li
      data-slot="sidebar-menu-sub-item"
      data-sidebar="menu-sub-item"
      className={cn('group/menu-sub-item relative', className)}
      {...props}
    />
  );
}

function SidebarMenuSubButton({
  render,
  size = 'md',
  isActive = false,
  className,
  ...props
}: useRender.ComponentProps<'a'> &
  React.ComponentProps<'a'> & {
    size?: 'sm' | 'md';
    isActive?: boolean;
  }) {
  return useRender({
    defaultTagName: 'a',
    props: mergeProps<'a'>(
      {
        className: cn(
          'flex h-7 min-w-0 -translate-x-px items-center gap-2 overflow-hidden rounded-md px-3 text-sidebar-foreground ring-sidebar-ring outline-hidden group-data-[collapsible=icon]:hidden hover:bg-sidebar-accent hover:text-sidebar-accent-foreground active:bg-sidebar-accent active:text-sidebar-accent-foreground disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 data-[size=md]:text-sm data-[size=sm]:text-xs data-active:bg-sidebar-accent data-active:text-sidebar-accent-foreground [&>span:last-child]:truncate [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:text-sidebar-accent-foreground',
          className,
        ),
      },
      props,
    ),
    render,
    state: {
      slot: 'sidebar-menu-sub-button',
      sidebar: 'menu-sub-button',
      size,
      active: isActive,
    },
  });
}

export {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupCount,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInput,
  SidebarInset,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarEmptyRow,
  SidebarProjectHeader,
  SidebarRail,
  SidebarSearch,
  SidebarSeparator,
  SidebarTrigger,
  useSidebar,
};
