# 01 — Plan: the product

What `Tasks.dc.html` draws, read as product rules. Where the frames
are prototype shortcuts (seed data, `localStorage`, stale model names)
this note says what the real thing does instead.

## 1. Where it lives

- **Rail.** Plan is the third rail item (icon `check-circle`), after
  Sessions and Automations, with the count of open tasks (not Done) on
  its tooltip.
- **Sidebar.** Two sections, **Tasks** (open count) and **Calendar**
  (today's event count). Under Tasks: **Projects**: All projects, each
  project with its open count, and Unassigned, plus "+" for New project.
  Under Calendar: the layer toggles (03 §1) and the Google Calendar sync
  card.
- **Routes.** `/plan` (the board, `?project=<slug>&goal=<id>`),
  `/plan/calendar` (`?month=2026-10`), and `?task=<id>` on either to open
  a task's dialog, which is the deep link the session header uses. The
  `/tanstack-routing` skill places them.
- **Keyboard.** `n` opens New task on the board and New event on the
  calendar, outside inputs.

## 2. The board

- **Header.** The title is "Tasks", the project's name, or "Unassigned".
  Under it: *n open · n in progress · n done · n overdue*, where the
  overdue count (red) is open tasks whose due date has passed. **New
  task** on the right.
- **Goals strip** (above the columns). One card per goal in the filtered
  project(s): name, project and target date, a progress bar and "*done* /
  *total* tasks" with its percentage, green at 100%. Clicking a goal
  filters the board to it (and back); "…" opens Edit goal. **New goal**
  on the strip's header.
- **Columns**, in this order: **Later** (hollow dot), **To do**, **In
  progress** (amber), **Done** (green), each with a count and "+".
- **A card** shows: a done checkbox, the title, notes (two lines, hidden
  when done), the project (only under All projects), the goal (unless
  filtered to it), the due date as Today / Tomorrow / Yesterday / *Oct 7*
  with the time if set (red when overdue, strong within a day), and the
  **session line** (§4). A Done card is struck through and drops notes
  and due date.
- **Interactions.** Drag a card within and across columns (it lands
  where dropped, FLIP-animated); tick the checkbox to move it to the
  top of Done, untick to the top of To do; "Add task" at a column's foot
  is an inline one-line composer (Enter adds, Esc cancels) that files the
  task under the current project and goal filter; clicking a card opens
  its dialog. Escape cancels a drag.

## 3. The dialogs

- **Task** (New task / Edit task): title, notes, then rows for
  **Status** (the four columns), **Project** (None and every project),
  **Goal** (None and the goals of the chosen project; picking a goal sets
  its project, changing project clears a goal from another),
  **Sessions** (§4), and **Due**: a date picker with Today, Tomorrow,
  Next Monday and Clear, plus an optional time on a 15-minute grid
  (choosing a time with no date picks today). Footer: Delete task,
  Cancel, Save / Add task. Enter saves.
- **Goal**: name ("What are you aiming for?"), **Project** (required;
  goals have no None), **Target** date with End of month and In 3
  months. Changing a goal's project moves its tasks with it; deleting a
  goal keeps its tasks and clears their goal.
- **Project** (from Plan's sidebar): name only in the frame. The real
  one is the console's existing New project dialog
  (`../mvp/05-screens.md`), so a project made here has default
  repositories, host and agent like any other.
- "None" in the frames is **Unassigned**: the workspace's Unassigned
  project, as for sessions (`../mvp/10-api-modules-and-data-model.md`).

## 4. Tasks and sessions

The point of Plan over any other board: a task is where work is asked
for, and a session is where it gets done.

- **Start session** (hover a card with no session, or the dialog's
  Sessions row) opens a launch dialog: "For "*task*"", a prompt
  prefilled with the title and the notes, and choices for
  **Repository** (the project's default repositories, with their base
  branch), **Host** (with its live dot), **Agent** and **Model** (with a
  one-line description). ⌘↩ starts. The defaults are the project's.
  Model and agent lists come from `packages/shared/src/agents/catalog.ts`,
  not the frame's names. Permission and effort take the New session
  defaults; the frame has no picker for them.
- Starting a session links it to the task and moves the task to **In
  progress**, unless it is Done (it stays Done).
- **Offline host.** If the chosen host is offline, a note says "*host*
  has been offline for *2 days*. The session waits as Queued and starts
  when its runner reconnects.", and the button reads **Queue session**.
- **Link existing** opens a searchable picker of the workspace's
  sessions not already linked to this task, the task's project's first
  ("In *project*"), then "Other sessions". A session can be linked to
  more than one task. Each linked row shows its state and age, opens the
  session, and unlinks with ×.
- **On the card**, the session line shows the linked session that most
  needs attention (Needs input, then Running, Failed, Idle, Completed),
  its name, and "+n" for the others; clicking it opens that session.
- **In the session**, a session linked to a task shows the task's title
  as a chip before its name in the terminal header ("Back to task"),
  which opens Plan on that task. With several tasks: the one that
  started it, else the most recently linked.

## 5. The 0.3 sketch's questions, answered by the frames

1. *What is a card?* A **task**, stored, that may start sessions or link
   existing ones, not a view of sessions. Sessions with no task stay off
   the board.
2. *Do columns move on their own?* Only on start (→ In progress). Every
   other move is a person's. (README open question 4)
3. *Does a card seed the prompt?* Yes: title and notes, editable before
   starting.
4. *Per project or per workspace?* One workspace board, filtered by
   project (and by goal); All projects is the default.
5. *Import from GitHub Issues or Linear?* Not in the frames. Ours only;
   a later source.

## 6. Not in the frames, decided here

- **Who.** Workspaces are personal, so tasks have no assignee. Every row
  records who created it, so teams later add an assignee column, not a
  migration of meaning.
- **Archived projects.** Archiving is already refused while a project
  has open sessions; it is also refused while it has open tasks (not
  Done), with the same "move or finish them first" copy. Its Done tasks
  and its goals stay, and leave the board with the project.
- **Closed sessions.** Sessions are closed, not deleted (`resolved`);
  a closed session stays linked and reads Completed on the card.
- **Empty states.** A workspace with no tasks shows the columns with
  their Add task rows and a goals strip that says "No goals yet" with
  New goal. The frames have no empty state drawn; it needs one in the
  next export.
- **Strings.** All copy goes into `packages/translations`.

## Open questions

1. A task's due date and time are wall-clock ("Oct 7 · 09:00"), read in
   the viewer's browser timezone; the API stores no user timezone today
   (`apps/api/src/profile/application/locale.resolver.ts`). Fine while
   nothing fires on a due time. A reminder email or a Slack nudge (0.4)
   would need a stored timezone first.
2. Should Done tasks age off the board (e.g. after 14 days, behind
   "Show older")? Done grows without bound otherwise.
3. Does a goal ever close (achieved / missed), or is 100% enough?
