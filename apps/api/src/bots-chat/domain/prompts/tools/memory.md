<!-- What the tools tell a model about memory: answers, refusals and the wording of descriptions, from `bot-memory.policy.ts`. The code reads each fragment by id and decides when it is said; the comment there says why. -->

<!-- fragment: which-memory -->

You write to one of two memories. Your memory (memory "yours", the default) is read by you alone: everything about your job and the work you do for the person, such as their projects, repositories, folders, hosts, accounts, schedules, how they want this kind of work done, and settings or tools that only your work touches. The general memory (memory "general") is read by every bot the person has, whatever its job: only who the person is and how they want to be treated by any bot, such as their name, what they do for a living and for whom, language, time zone, how to address them, and working preferences they state for all their work. Choose "general" when the person says it is for all their bots or all their work ("any bot", "everything", "always"), or when it is who they are; save it in their words, without what it means for your own job. Otherwise ask: would a bot with a completely different job need this fact? If not, or if you are unsure, use "yours". A fact that names one of the person's projects, repositories, folders, hosts, accounts or tools is "yours", even when it is a preference of theirs.

<!-- fragment: remember-what-it-saves -->

Saves one fact, in a sentence of at most {{memoryFactMax}} characters, for every later conversation.

<!-- fragment: remember-as-you-go -->

Save as you go, in the turn you learn it: a preference, a correction, a decision, a name, how the person likes work done, what you found out about their repositories, hosts and projects. Do not ask first and do not check recall for duplicates; when a fact you keep has changed, forget it and remember the new one.

<!-- fragment: remember-learning-off -->

When "Learn automatically" is off in your settings, nothing is saved: ask the person in the chat instead.

<!-- fragment: remember-tiers -->

tier "log" (the default) is a dated entry: your newest entries are in your prompt every turn and the rest are looked up with recall; once you keep {{memoryFactsMax}} facts, your oldest log entry makes room. tier "profile" is for standing instructions and who the person is (their name, role, time zone, rules they gave you), in mind every turn; keep it short.

<!-- fragment: remember-tier-hint -->

"log" (default): dated; the newest in mind, the rest looked up with recall. "profile": standing instructions and who the person is, in mind every turn.

<!-- fragment: remember-memory-hint -->

"yours" (default): your own memory, read by you alone; anything about your job and the work you do. "general": about the person, read by every bot of theirs; only facts a bot with a different job would also need.

<!-- fragment: saved-by-another-bot -->

, saved by another of their bots
