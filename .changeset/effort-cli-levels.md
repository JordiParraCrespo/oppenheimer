---
"@oppenheimer/shared": minor
"@oppenheimer/api": minor
"@oppenheimer/api-client": minor
"@oppenheimer/runner": minor
"@oppenheimer/web": minor
"@oppenheimer/translations": minor
"@oppenheimer/design-system-web": minor
---

Effort is each CLI's own levels, per model, instead of five product stops.

- `@oppenheimer/shared`: each model lists its effort levels and default, each agent spells a level once, and `effortLevelFor` decides what may be recorded.
- `@oppenheimer/runner`: launch effort is keyed by model and dropped when the model lacks it or the saved launch predates levels.
- `@oppenheimer/api` / `@oppenheimer/api-client`: sessions, their log and automation revisions record only a level their model offers.
- `@oppenheimer/web` / `@oppenheimer/translations`: the slider draws the model's levels and sends nothing until moved.
- `@oppenheimer/design-system-web`: `EffortSlider` and `EffortPicker` take their stops from the caller; `EFFORT_STOPS` is gone.
