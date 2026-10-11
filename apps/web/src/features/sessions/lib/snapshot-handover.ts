/** How many frames that paint nothing a kept picture outlasts before giving way. */
const HELD_FRAMES = 16;

/**
 * The hand-over from a kept picture (`terminal-snapshots.ts`) to the live
 * screen, as a gate every frame from the far end passes through.
 *
 * While the picture is up, frames that paint nothing (tmux's attach preamble
 * may arrive on its own) are held rather than written: resetting for them
 * would blank the pane before the redraw, and writing them over the picture
 * would lose the modes they set to the reset that follows. The first frame
 * that draws resets the grid and writes every held frame in order. A cap
 * gives way anyway, so a link that never draws cannot sit on its credit.
 *
 * With no picture the gate is open from the start and only writes.
 */
export function createSnapshotHandover<Frame>(
  showingPicture: boolean,
  grid: { reset: () => void; write: (frame: Frame) => void },
) {
  let holding = showingPicture;
  let held: Frame[] = [];

  return {
    /** Whether the picture is still up, so the caller knows `draws` matters. */
    holding: () => holding,
    pass(frame: Frame, draws: boolean) {
      if (!holding) {
        grid.write(frame);
        return;
      }
      held.push(frame);
      if (!draws && held.length < HELD_FRAMES) return;
      holding = false;
      grid.reset();
      for (const each of held) grid.write(each);
      held = [];
    },
  };
}
