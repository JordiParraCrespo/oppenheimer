"use client";

import { BrandMark } from "@oppenheimer/design-system-web/brand-mark";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@oppenheimer/design-system-web/sidebar";
import * as React from "react";
import { TOC, TOC_COUNT } from "@/lib/toc";

/**
 * The design system's table of contents. Every entry on the page gets a row,
 * grouped the way the inventory is grouped, and the row for whatever section
 * is currently in view fills with the sunken surface.
 */
export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const active = useActiveSection();

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <div className="flex items-center gap-2.5 px-2 py-2">
          <span className="flex size-6 shrink-0 items-center justify-center">
            <BrandMark size={20} />
          </span>
          <span className="min-w-0 leading-tight">
            <span className="block truncate text-base font-medium text-ink-900">
              Design system
            </span>
            <span className="block truncate text-xs text-ink-400">
              {TOC_COUNT} components
            </span>
          </span>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {TOC.map((section) => (
          <SidebarGroup key={section.group}>
            <SidebarGroupLabel>{section.group}</SidebarGroupLabel>
            <SidebarMenu>
              {section.items.map((item) => (
                <SidebarMenuItem key={item.id}>
                  <SidebarMenuButton
                    tooltip={item.label}
                    isActive={active === item.id}
                    render={<a href={`#${item.id}`} />}
                  >
                    <item.icon />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  );
}

/**
 * Tracks which `<section id>` is in view inside the main scroll container.
 *
 * A scroll calculation rather than an IntersectionObserver, because the two
 * edges of the page need explicit answers an observer does not give: at the
 * very top nothing has crossed the trigger line yet, and the final section can
 * never reach it — there is no content left to scroll past it. So: the active
 * section is the last one whose top has passed the trigger line, except when
 * scrolled to the bottom, where it is simply the last section.
 */
const TRIGGER_OFFSET = 120;

function useActiveSection() {
  const [active, setActive] = React.useState<string | null>(null);

  React.useEffect(() => {
    const root = document.getElementById("main-scroll");
    if (!root) return;

    const sections = Array.from(
      root.querySelectorAll<HTMLElement>("section[id]"),
    );
    if (sections.length === 0) return;

    let frame = 0;

    function update() {
      frame = 0;
      if (!root) return;

      const atBottom =
        root.scrollTop + root.clientHeight >= root.scrollHeight - 2;
      if (atBottom) {
        setActive(sections[sections.length - 1].id);
        return;
      }

      const line = root.getBoundingClientRect().top + TRIGGER_OFFSET;
      let current = sections[0].id;
      for (const section of sections) {
        if (section.getBoundingClientRect().top <= line) current = section.id;
        else break;
      }
      setActive(current);
    }

    function onScroll() {
      if (frame === 0) frame = requestAnimationFrame(update);
    }

    update();
    root.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      if (frame !== 0) cancelAnimationFrame(frame);
      root.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return active;
}
