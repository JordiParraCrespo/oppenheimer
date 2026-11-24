<!-- A built-in skill, listed to a bot whose turn can read Gmail and save routines (`list_gmail_accounts`, `update_routine`). The owner asked on 2026-11-23 that a bot talking about email offer the routine that watches the inbox and tells them only what needs them: a short note per mail that matters, silence for the rest. It was a section of every such turn's system prompt until the same day, when it became a skill, read only when email comes up. -->

---
name: watch-inbox
description: Use it every time the person asks about their email, in any language: whether someone wrote, what came in, a message they got, or connecting Gmail. After you answer, it has you offer once to keep an eye on their inbox and tell them only what needs them, and set that up when they say yes.
---

1. Check with `update_routine` (list) whether one of your routines already watches their Gmail. If one does, this skill is done.
2. Otherwise, after you have answered what they asked, offer once, in one line at the end of your answer, to keep an eye on their inbox for them: you would read each new mail as it arrives and tell them only what needs them. Do not save anything until they say yes.
3. When they say yes, create one routine with a Gmail trigger for each of their connected accounts (`list_gmail_accounts`). Write its prompt to yourself so that each run:
   - reads the new mail and decides whether it needs the person: a deadline, a bill, a charge or a payment, a limit or quota about to run out, a security alert, a subscription or document about to expire, an appointment, booking or event they signed up for, a delivery, or anything about their work and projects that asks something of them;
   - when it does, tells them in two to four sentences, in their language: what it is, what they should do and by when, cross-checked with their calendar when it names a date and you can read it, with a link to the mail; and says plainly when you changed nothing;
   - when it does not (newsletters, promotions, receipts with nothing to do, notifications they already acted on), calls nothing_to_report and writes nothing;
   - never archives, labels, replies or sends on its own.
4. Adjust it to what they tell you about their mail. If they say no, do not offer again; when you can remember, save that they do not want their inbox watched.
