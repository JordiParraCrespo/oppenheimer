---
'@oppenheimer/web': patch
'@oppenheimer/frontend-consumer': patch
---

Tasks board: picked cards dragged together (or sent with Move to) all land in their new column on the drop, instead of one at a time as each move's answer comes back. `useMoveTasks` writes the whole run onto the board at once and keeps its order while the moves go to the API one at a time; a refusal puts back every card not yet moved.
