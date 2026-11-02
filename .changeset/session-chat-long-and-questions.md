---
"@oppenheimer/design-system-web": minor
"@oppenheimer/frontend-consumer": minor
"@oppenheimer/translations": patch
"@oppenheimer/web": minor
---

A session's chat keeps its tool calls folded to their summary line, also while the agent is still in the run, with the call in flight under it. A long conversation stays quick: the chat store rebuilds only the open turn on each line (a closed turn keeps its identity, unless a result lands on one of its calls), and the view draws the latest 40 turns with "Show earlier turns" above them, opened without moving the reader. Claude Code's questions answer better: the agent's tag over each question, focus on the first option so the number keys answer at once, a lone one-choice question answered by the pick as the terminal picker does, Enter to move on from an answer in the person's own words, and answers that could not be typed stay to be sent again (`SessionChat.answer` returns whether they went). `QuestionPanel` takes `header` and `autoFocus`.
