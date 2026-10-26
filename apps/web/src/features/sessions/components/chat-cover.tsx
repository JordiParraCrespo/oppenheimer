import type { ClipboardEvent, ReactNode } from 'react';

/**
 * The pane's chat, drawn over a terminal's grid, which stays mounted under it
 * at its size so tmux is never resized. It paints the chat's own ground, the
 * terminal's colour (`--chat-ground`), so nothing of the grid shows through
 * and switching views changes no colour; `data-chat-ground` tells the turns
 * drawn on it which ground they stand on (`--chat-turn`).
 */
export function ChatCover({
  onPasteCapture,
  children,
}: {
  onPasteCapture?: (event: ClipboardEvent<HTMLDivElement>) => void;
  children: ReactNode;
}) {
  return (
    <div
      data-chat-ground="terminal"
      className="absolute inset-0 bg-chat-ground font-sans text-fg"
      onPasteCapture={onPasteCapture}
    >
      {children}
    </div>
  );
}
