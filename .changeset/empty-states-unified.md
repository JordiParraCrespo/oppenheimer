---
'@oppenheimer/design-system-web': minor
'@oppenheimer/frontend-web': patch
'@oppenheimer/translations': patch
'@oppenheimer/web': patch
---

Empty states follow one pattern in three tiers. `EmptyState.Art` draws one
of eight illustrations from a single family (inbox, projects, pull requests,
done, automations, milestones, tasks, not found), and it stands over a
screen's main region the first time it is empty or once it is through:
Projects, the pull-request queue and the end of the review deck, both
Automations tabs, Milestones, an empty day in TODO, the Inbox and the
not-found page. Any other state of a pane, and every Settings section, takes
the 44px icon disc (Hosts, a pull request with no changes, filters that match
nothing, a project or automation that is gone, a bot with no routines);
sidebars, rows and pickers keep their one muted line. `InboxClear` is now an
illustrated `EmptyState`; `RoutineTableEmpty` and `MilestoneEmpty` are gone,
and so is the console's `HostsEmpty`.
