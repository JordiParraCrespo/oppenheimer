---
"@oppenheimer/design-system-web": patch
---

Composer: give the prompt box back the height the design gives it.

`field-sizing-content` sizes a textarea to its content and overrides the `rows`
attribute outright, so the empty composer collapsed to a single line while every
class still looked correct. The export's floor is 112px, which is the prompt box
having presence before anyone has typed into it — the whole point of the
control. It is a `min-h` now, with `rows` kept as the no-`field-sizing`
fallback.

Measured against `.op-composer__input` in the same pass: the textarea's vertical
padding is 16px both sides rather than 16/8, the attach and mic buttons are the
export's 30px tool rather than the 28px `sm` control, and their glyphs and the
send arrow are 15px at stroke 2.2.

The type is a new `text-compose` step (16px/1.5). The export declares 16px
nowhere but this one rule — it sits between body (15px) and body-lg (17px) —
which is the same case `text-operate` already documents, so it is a named token
with a comment rather than an arbitrary value or a rounding to the nearest step.
