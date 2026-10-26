---
"@oppenheimer/design-system-web": minor
"@oppenheimer/web": minor
"@oppenheimer/translations": patch
---

The engine picker follows the version-1 design: one button for agent, model and effort, a popup with a tab per agent and one of starred Favourites, a search across every agent's models, and the effort slider at its foot. Favourites are kept on the device. `AgentModelSelect` takes `favourites`, `onFavouritesChange`, `effort` and `labels`; `engineKey` names a favourite. New session's choices row (`ComposerChoices`) stays on one line: the place chips truncate and the engine keeps its width.
