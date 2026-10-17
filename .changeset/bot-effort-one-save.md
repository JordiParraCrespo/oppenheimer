---
"@oppenheimer/design-system-web": minor
"@oppenheimer/web": patch
---

A bot's effort saves once per adjustment, when its picker closes, instead of once per stop the knob crosses, which a drag across the track turned into a burst of updates the API refused as too many requests. `EffortPicker` takes an optional `onOpenChange` so the caller can tell when it closes.
