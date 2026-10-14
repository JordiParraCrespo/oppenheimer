---
"@oppenheimer/design-system-web": minor
"@oppenheimer/frontend-web": patch
---

A form's fields stand at one height. `DatePicker` (28px, though its notes
said 34px) and `FieldSelect`'s field look (42px) take a `size` on the control
ramp and default to `md`, 34px, the same rung as `Input`, on the same field
border and fill. `Chip` takes `size="md"` for a chip that is a form's field,
and `TimeField`'s trigger moves to `md` beside the `DatePicker`.
