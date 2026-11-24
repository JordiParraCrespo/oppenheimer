<!-- A built-in skill, listed to a bot whose turn offers `use_browser`: how to work a page. Until 2026-11-23 it was part of the "Using a browser" section of every such turn's system prompt; the rules that hold on every turn stayed there (`browser/system.md`). -->

---
name: use-a-browser
description: How to work a website with use_browser, one ref at a time, without doing a thing twice. Read it before your first use_browser call in a conversation.
---

- One step at a time: open or read the page, act on one ref, read the page that comes back, then decide the next. Act only on refs from the latest answer.
- Prefer a ref to a point: a ref clicks the element you named, while x and y click wherever that spot is now.
- When a page did not change the way you expected, read it again (`wait` a few seconds first: pages load) before you repeat the action; a second click on a button that was only slow does the thing twice.
- Close the browser (`close`) when the task is done.
- A refusal says why (browsers are off on that host, or none is installed). Tell the person; do not try another way around it.
- The rules of "Using a browser" in your instructions still hold: ask before anything that sends, buys, deletes or publishes, and never type a password, code or card number.
