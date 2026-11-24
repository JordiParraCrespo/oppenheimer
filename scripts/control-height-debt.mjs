/**
 * The controls `control-heights.mjs` found standing off the 28 / 34 / 42
 * ramp when the campaign started (`.agents/skills/control-height-campaign/`):
 * each file that held some, with how many. Debt, paid off by moving the
 * control onto `--control-h-*` or a component's `size`. The check holds each
 * file to its count: one more fails, and one fewer fails until the count here
 * comes down, so this list only shrinks. Nothing is added here; a new control
 * takes the ramp where it is written.
 */
export const CONTROL_HEIGHT_DEBT = new Map([
  ['packages/frontend/design-system/web/src/components/avatar-picker.tsx', 2],
  ['packages/frontend/design-system/web/src/components/bot-item.tsx', 1],
  ['packages/frontend/design-system/web/src/components/button.tsx', 2],
  ['packages/frontend/design-system/web/src/components/calendar-source.tsx', 2],
  ['packages/frontend/design-system/web/src/components/chat-cards.tsx', 2],
  ['packages/frontend/design-system/web/src/components/chat-elements.tsx', 2],
  ['packages/frontend/design-system/web/src/components/chat-header.tsx', 1],
  ['packages/frontend/design-system/web/src/components/chat-image.tsx', 1],
  ['packages/frontend/design-system/web/src/components/chat-status.tsx', 3],
  ['packages/frontend/design-system/web/src/components/chat-transcript.tsx', 3],
  ['packages/frontend/design-system/web/src/components/chat-work.tsx', 1],
  ['packages/frontend/design-system/web/src/components/chip-select.tsx', 1],
  ['packages/frontend/design-system/web/src/components/date-range-picker.tsx', 2],
  ['packages/frontend/design-system/web/src/components/diff-view.tsx', 1],
  ['packages/frontend/design-system/web/src/components/editor-page.tsx', 1],
  ['packages/frontend/design-system/web/src/components/effort-slider.tsx', 1],
  ['packages/frontend/design-system/web/src/components/host-link.tsx', 1],
  ['packages/frontend/design-system/web/src/components/icon-button.tsx', 1],
  ['packages/frontend/design-system/web/src/components/milestone-timeline.tsx', 1],
  ['packages/frontend/design-system/web/src/components/month-calendar.tsx', 3],
  ['packages/frontend/design-system/web/src/components/password-input.tsx', 1],
  ['packages/frontend/design-system/web/src/components/people-picker.tsx', 1],
  ['packages/frontend/design-system/web/src/components/project-overview.tsx', 1],
  ['packages/frontend/design-system/web/src/components/rail.tsx', 2],
  ['packages/frontend/design-system/web/src/components/repository-row-list.tsx', 1],
  ['packages/frontend/design-system/web/src/components/routine-item.tsx', 2],
  ['packages/frontend/design-system/web/src/components/runs-list.tsx', 1],
  ['packages/frontend/design-system/web/src/components/session-item.tsx', 2],
  ['packages/frontend/design-system/web/src/components/settings-nav.tsx', 1],
  ['packages/frontend/design-system/web/src/components/switch.tsx', 1],
  ['packages/frontend/design-system/web/src/components/task-board.tsx', 2],
  ['packages/frontend/design-system/web/src/components/time-grid.tsx', 1],
  ['packages/frontend/design-system/web/src/components/todo-row.tsx', 2],
]);

/**
 * What the scanner lists that is not a control standing in a row of
 * controls, so it is not debt: each file's count and why. A file here is
 * held to its count like the debt; a new entry needs the campaign's ledger
 * to say what it is ("Not a control").
 */
export const NOT_A_CONTROL = new Map([
  [
    'packages/frontend/design-system/web/src/components/sidebar.tsx',
    {
      count: 6,
      why: 'the navigation list: its menu buttons are rows (default, sm, lg and the collapsed square), the row action is a row glyph, and the search clear button is a glyph inside the field',
    },
  ],
  [
    'packages/frontend/design-system/web/src/components/chat-composer-stack.tsx',
    {
      count: 1,
      why: "the composer band's actions, part of the composer the user keeps as it was (JordiParraCrespo/oppenheimer#1026)",
    },
  ],
  [
    'packages/frontend/design-system/web/src/components/composer.tsx',
    {
      count: 4,
      why: 'the composer, kept as the user wants it: its own sizes for attach, emoji, mic and send on its line, and the context meter (decided on JordiParraCrespo/oppenheimer#1026; .agents/answers.md)',
    },
  ],
  [
    'packages/frontend/design-system/web/src/components/chat-composer.tsx',
    {
      count: 2,
      why: 'the composer, kept as the user wants it: its own sizes for attach, emoji, mic and send on its line, and the context meter (decided on JordiParraCrespo/oppenheimer#1026; .agents/answers.md)',
    },
  ],
  [
    'packages/frontend/design-system/web/src/components/chat-composer-extras.tsx',
    {
      count: 2,
      why: 'the composer, kept as the user wants it: its own sizes for attach, emoji, mic and send on its line, and the context meter (decided on JordiParraCrespo/oppenheimer#1026; .agents/answers.md)',
    },
  ],
  [
    'packages/frontend/web/src/chat/components/composer-emoji-button.tsx',
    {
      count: 1,
      why: 'the composer, kept as the user wants it: its own sizes for attach, emoji, mic and send on its line, and the context meter (decided on JordiParraCrespo/oppenheimer#1026; .agents/answers.md)',
    },
  ],
  [
    'packages/frontend/web/src/chat/components/emoji-picker.tsx',
    {
      count: 2,
      why: 'a grid of emoji cells and the full-width strip of category tabs above it, each its own surface, never beside a control',
    },
  ],
]);
