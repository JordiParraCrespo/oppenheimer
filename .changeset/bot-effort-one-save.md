---
"@oppenheimer/design-system-web": minor
"@oppenheimer/web": patch
---

`EffortPicker` takes `onValueCommit`, called once with the pick when its popover closes. A bot's effort now saves once per adjustment instead of once per stop the knob crosses, which a drag across the track turned into a burst of updates the API refused as too many requests.
