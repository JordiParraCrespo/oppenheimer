'use client';

import { Launcher, LauncherHeading, LauncherItem } from '@oppenheimer/design-system-web/launcher';
import { GlobeIcon, MessageSquarePlusIcon, MonitorIcon, SmartphoneIcon, SquareTerminalIcon } from 'lucide-react';

export function LauncherDemo() {
  return (
    <div className="flex h-96 w-full max-w-110 flex-col justify-center rounded-lg border border-border-subtle bg-card">
      <Launcher aria-label="Open beside this session">
        <LauncherItem icon={<SquareTerminalIcon />} busy>
          Opening a terminal…
        </LauncherItem>
        <LauncherItem icon={<GlobeIcon />}>Browser</LauncherItem>
        <LauncherItem icon={<MessageSquarePlusIcon />}>Side chats</LauncherItem>
        <LauncherHeading>Only when this console has them</LauncherHeading>
        <LauncherItem icon={<SmartphoneIcon />}>Simulator</LauncherItem>
        <LauncherItem icon={<MonitorIcon />} detail="mac-studio">
          Desktop
        </LauncherItem>
      </Launcher>
    </div>
  );
}
