/**
 * The controls `control-heights.mjs` found standing off the 28 / 34 / 42
 * ramp when the campaign started (`.agents/skills/control-height-campaign/`):
 * each file that held some, with how many. Debt, paid off by moving the
 * control onto `--control-h-*` or a component's `size`. The check holds each
 * file to its count: one more fails, and one fewer fails until the count here
 * comes down, so this list only shrinks. Nothing is added here; a new control
 * takes the ramp where it is written.
 */
export const CONTROL_HEIGHT_DEBT = new Map([]);

/**
 * What the scanner lists that is not a control standing in a row of
 * controls, so it is not debt: each file's count and why. A file here is
 * held to its count like the debt; a new entry needs the campaign's ledger
 * to say what it is ("Not a control").
 */
export const NOT_A_CONTROL = new Map([
  [
    'packages/frontend/design-system/web/src/components/chat-cards.tsx',
    {
      count: 1,
      why: "the subagent card's Stop all, kept at 24px by the user's call (pass 4; .agents/answers.md)",
    },
  ],
  [
    'packages/frontend/design-system/web/src/components/chat-elements.tsx',
    {
      count: 1,
      why: "a source pill under a reply, kept at 26px by the user's call (pass 4; .agents/answers.md)",
    },
  ],
  [
    'packages/frontend/design-system/web/src/components/chat-status.tsx',
    {
      count: 1,
      why: "a chat error's action, kept at 26px by the user's call (pass 4; .agents/answers.md)",
    },
  ],
  [
    'packages/frontend/design-system/web/src/components/avatar-picker.tsx',
    {
      count: 2,
      why: "the colour swatches, a grid of choices; and Shuffle, kept at 30px by the user's call (pass 4; .agents/answers.md)",
    },
  ],
  [
    'packages/frontend/design-system/web/src/components/bot-item.tsx',
    { count: 1, why: 'a sidebar row of the bots list' },
  ],
  [
    'packages/frontend/design-system/web/src/components/button.tsx',
    {
      count: 2,
      why: "the `xs` rung (24px) the user kept for a glyph action that stands alone (a row's menu, a message's copy)",
    },
  ],
  [
    'packages/frontend/design-system/web/src/components/icon-button.tsx',
    { count: 1, why: 'the `xs` rung (24px) the user kept for a glyph action that stands alone' },
  ],
  [
    'packages/frontend/design-system/web/src/components/calendar-source.tsx',
    { count: 2, why: 'a row of the calendar accounts list and the disconnect glyph on it' },
  ],
  [
    'packages/frontend/design-system/web/src/components/chat-image.tsx',
    { count: 1, why: "the remove glyph on an image's corner" },
  ],
  [
    'packages/frontend/design-system/web/src/components/chat-transcript.tsx',
    { count: 2, why: "the reaction picker's strip of emoji and its more button" },
  ],
  [
    'packages/frontend/design-system/web/src/components/chat-work.tsx',
    { count: 1, why: "a tool call's row, a line of text that folds" },
  ],
  [
    'packages/frontend/design-system/web/src/components/chip-select.tsx',
    { count: 1, why: "the strip of tabs under a picker's search" },
  ],
  [
    'packages/frontend/design-system/web/src/components/date-range-picker.tsx',
    { count: 2, why: "the presets list's rows and the month's day cells" },
  ],
  [
    'packages/frontend/design-system/web/src/components/host-link.tsx',
    { count: 1, why: "the terminal status bar's chip, on that bar's own type" },
  ],
  [
    'packages/frontend/design-system/web/src/components/milestone-timeline.tsx',
    { count: 1, why: 'a milestone diamond on its track' },
  ],
  [
    'packages/frontend/design-system/web/src/components/month-calendar.tsx',
    { count: 3, why: "a day cell's entries and its more link" },
  ],
  [
    'packages/frontend/design-system/web/src/components/password-input.tsx',
    { count: 1, why: 'the reveal glyph inside the field' },
  ],
  [
    'packages/frontend/design-system/web/src/components/people-picker.tsx',
    { count: 1, why: 'the remove glyph inside a person chip' },
  ],
  [
    'packages/frontend/design-system/web/src/components/project-overview.tsx',
    { count: 1, why: 'a row of the overview list' },
  ],
  [
    'packages/frontend/design-system/web/src/components/rail.tsx',
    { count: 2, why: "the rail's mark and its items, the navigation column" },
  ],
  [
    'packages/frontend/design-system/web/src/components/routine-item.tsx',
    { count: 2, why: 'a sidebar row and the run row under it' },
  ],
  [
    'packages/frontend/design-system/web/src/components/runs-list.tsx',
    { count: 1, why: 'a row of the runs table' },
  ],
  [
    'packages/frontend/design-system/web/src/components/session-item.tsx',
    { count: 2, why: 'a sidebar row and the rename field inside it' },
  ],
  [
    'packages/frontend/design-system/web/src/components/settings-nav.tsx',
    { count: 1, why: 'a row of the settings navigation' },
  ],
  [
    'packages/frontend/design-system/web/src/components/switch.tsx',
    { count: 1, why: "the switch's track" },
  ],
  [
    'packages/frontend/design-system/web/src/components/time-grid.tsx',
    { count: 1, why: "the time grid's cells" },
  ],
  [
    'packages/frontend/design-system/web/src/components/todo-row.tsx',
    { count: 2, why: "a TODO row's grip and the inline field inside it" },
  ],
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
