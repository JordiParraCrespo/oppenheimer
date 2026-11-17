---
'@oppenheimer/web': patch
'@oppenheimer/frontend-consumer': patch
---

Tasks board: picked cards dragged together (or sent with Move to) all land in their new column on the drop, instead of one at a time as each move's answer comes back. `usePlaceTasks` writes the whole run onto the board at once; the moves still go to the API in order.
