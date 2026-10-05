---
"@oppenheimer/web": patch
---

Plan: moving between the board and the calendar from the sidebar no longer
breaks the screen. Each sidebar is drawn for a moment after its route has gone,
while the other one loads, and it now reads its route's search only while that
route is matched. The board's columns scroll into the page's gutters, so the
fourth one scrolls to the edge instead of stopping short of it.
