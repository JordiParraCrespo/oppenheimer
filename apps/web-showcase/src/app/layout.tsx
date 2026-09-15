import {
  SidebarInset,
  SidebarProvider,
} from "@oppenheimer/design-system-web/sidebar";
import type { Metadata } from "next";
import { AppSidebar } from "@/components/app-sidebar";
import { TopBar } from "@/components/top-bar";
import "./globals.css";

export const metadata: Metadata = {
  title: "Oppenheimer Showcase",
  description: "Design system component showcase",
};

/** Applies the stored theme before first paint so reloads don't flash. */
const THEME_SCRIPT = `try{if(localStorage.theme==='dark')document.documentElement.classList.add('dark')}catch(e){}`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // `suppressHydrationWarning` is needed on both elements, and for different
    // reasons: THEME_SCRIPT adds `.dark` to <html> before React hydrates, and
    // browser extensions routinely stamp attributes onto <body> (ColorZilla's
    // `cz-shortcut-listen`, Grammarly's `data-gr-*`). The flag only covers the
    // element it sits on, so the one on <html> does not reach <body>.
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: pre-paint theme script must run inline */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body suppressHydrationWarning>
        {/* The shell is pinned to the viewport so the topbar and sidebar stay
            put and only the main column scrolls — which is also what lets the
            sidebar's scroll-spy watch the right scroll root. `overflow-clip`
            rather than `-hidden`: a hidden box is still scrollable
            programmatically, so `scrollIntoView` on a section would drag the
            topbar out of view. Clip creates no scroll container at all. */}
        <SidebarProvider className="h-svh overflow-clip">
          <AppSidebar />
          <SidebarInset className="h-svh min-h-0 overflow-clip">
            <TopBar />
            {children}
          </SidebarInset>
        </SidebarProvider>
      </body>
    </html>
  );
}
