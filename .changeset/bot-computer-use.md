---
'@oppenheimer/shared': minor
'@oppenheimer/runner': minor
'@oppenheimer/api': minor
'@oppenheimer/backend-agents': minor
---

A bot can use a computer on a host. `use_computer` does one thing on the
host's screen (look, click, double-click, right-click, drag, scroll, type,
press keys, wait) and returns a picture of the screen after it, which the
bot's model reads before its next step.

The host decides: nothing happens until the person there runs `runner
computer on` (`runner computer` shows the setting and the screen a bot would
get). A Mac's main display is driven through `screencapture` and `osascript`
and needs Screen Recording and Accessibility; a Debian or Ubuntu host needs
`xdotool`, ImageMagick and `xauth`, and gets a virtual screen (Xvfb) when it
has no display; a Wayland session is refused.

On the link this is `computer.act` / `computer.screen`, gated on the new
`computer.use` capability. Refusals are `COMPUTER_001` (off on the host),
`COMPUTER_002` (no screen the runner can use), `COMPUTER_003` (the action
does not fit), `COMPUTER_004` (the screen could not be read or used) and
`COMPUTER_005` (the setting cannot be read). A bot tool's answer can now
carry images to the model, through both engines.
