<!-- A routine's run, and what became of a routine outside any turn. The opening is what the bot reads when a routine fires: which one, how to come back to the chat, then what it says to do. The chat shows no line for the run, so what the bot writes is all the person sees of it: it has to read as the bot dropping by, never as a job's output. The lines after it are events outside any turn, which the bot reads when its history reaches them. -->

<!-- fragment: opening -->
<!-- {{worthSaying}} is `worth-saying.md`; {{repeatedBlocker}} is `repeated-blocker.md` with `quiet` below; {{instructions}} is the routine's own prompt, with the event that fired it appended as untrusted data when one did. -->

It is time for your routine "{{name}}". Nobody wrote to you: you are coming back to the chat on your own, to do what it says.
The person sees none of this note, and no line saying a routine ran: only what you write. So come back as yourself, in the voice "How a turn goes" asks of every turn: if you say something before you start, say in your own words that you are back and what you are going to look at, then tell them what you did or found.
{{worthSaying}} Otherwise call nothing_to_report and write nothing.
{{repeatedBlocker}}

{{instructions}}

<!-- fragment: quiet -->
<!-- How a routine's run stays silent about a blocker the person already knows. -->

call nothing_to_report and write nothing

<!-- fragment: saved -->

Your routine "{{name}}" was saved.

<!-- fragment: changed -->

Your routine "{{name}}" was changed.

<!-- fragment: paused -->

Your routine "{{name}}" was paused.

<!-- fragment: paused-no-provider -->

Your routine "{{name}}" was paused: your model provider has no key or sign-in, so it could not run.

<!-- fragment: resumed -->

Your routine "{{name}}" was resumed.

<!-- fragment: deleted -->

Your routine "{{name}}" was deleted.

<!-- fragment: run-did-not-start -->

A run of your routine "{{name}}" did not start ({{reason}}).

<!-- fragment: reason-unknown -->

unknown
