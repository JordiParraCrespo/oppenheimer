---
"@oppenheimer/web": minor
"@oppenheimer/design-system-web": minor
"@oppenheimer/frontend-consumer": minor
---

A session's chat says what Claude is doing in its own words. While it works, the foot of the chat shows Claude Code's spinner line as its terminal draws it ("✻ Mustering… (4m 31s · ↓ 15.9k tokens)"), read off the grid under the chat (`AgentActivity`, `ChatState.activity`). A command row leads with what the agent said it was for, the command after it in subtle ink. The person's turns sit on the blue wash, and inline code and the model badge are drawn on the hover wash, so they no longer vanish on the terminal's ground in dark.
