<!-- What opens a turn whose message starts with a slash command: the skill the person ran, a command that names no skill of theirs, a /goal the console should have run, or one of the commands that set something going (/schedule, /goal, /loop). The person's own words follow the first three, as they wrote them; the last three carry them in a slot. -->

<!-- fragment: ran-a-skill -->
<!-- OpenClaw's skill commands, which "route to the model as a normal request": the skill, then their message, whose words after the command are the skill's input. -->

The person ran your skill /{{name}}. Follow it for this request. {{input}}

<!-- fragment: with-input -->

What they wrote after the command is its input.

<!-- fragment: with-no-input -->

They gave it no input: use what the chat already says, or ask for what it needs.

<!-- fragment: not-a-skill -->
<!-- A typo, a deleted skill, or only a path. The bot is told which commands it has, so it can say so rather than guess. -->

The message starts with /{{name}}, which is not one of your skills. {{yours}} If they meant a skill, say so in a sentence and suggest the closest one; if it is not a command (a path, say), read the message as written.

<!-- fragment: skills-they-can-run -->

The skills they can run are {{skills}}.

<!-- fragment: no-skills-to-run -->

You have no skills they can run.

<!-- fragment: goal-command -->
<!-- A `/goal` that shows or clears the goal is the console's to run and the API refuses to send one; this only reads one that came from before that rule, so the bot answers in a line. -->

The person typed a /goal command that shows or clears your goal; Oppenheimer runs those itself. Say in a line what your goal is now, if you have one.

<!-- fragment: schedule -->
<!-- The turn's message when the person runs `/schedule <request>`: save the routine it asks for now, on a schedule in their time zone, and say what was saved. A schedule runs at most once a day at a time of day; a request for minutes is a /loop, and one with no time is asked about, never guessed. -->

The person ran /schedule to have you save a routine: {{request}}
Create it now with update_routine (action create): a short name, the prompt you will run each time written to yourself, and a schedule trigger in their time zone. Their /schedule is their consent to this one routine, so it does not ask them.
A schedule runs once at a time of day on the days it names (daily, weekdays, weekly, monthly, or once on a date). If they want it every few minutes, tell them /loop does that instead and save nothing. If the request says what to do but not when, ask them when in one line and save nothing yet.
Then say in one line what you scheduled and when it runs.

<!-- fragment: goal-set -->
<!-- The turn's message when the person runs `/goal <condition>`: the goal is already set, so the turn starts on it with the condition as its directive, and says how it will be judged. -->

The person set you a goal with /goal. Work toward it now: {{condition}}
After each of your turns another one comes, for as long as the goal is open: take a real step each turn and report it. There is no limit on turns, so do the work properly rather than fast.
When the condition holds, run the check it names, say what it answered, and call end_goal with outcome met: a reviewer then reads what you showed and ends the goal, or sends you on with its reason. It judges only what your words show: a claim with no shown check does not count.
If the goal cannot go on without the person, call end_goal with outcome blocked and say what you need.

<!-- fragment: loop-set -->
<!-- The first line of the turn the person's `/loop` opens: the loop is set, and this is its first run. The rules every run carries follow it (`routines/wake-loop.md`). -->

The person set a loop with /loop: you run this {{cadence}} for up to 3 days, and this is the first run: {{prompt}}
