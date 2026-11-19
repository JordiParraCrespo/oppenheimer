<!-- The turns a decision on a Needs input card gives the bot. The line that opens each is one text for two readers: the chat draws it as a small line, and the bot reads it as a note from Oppenheimer. A yes gives two turns: one at once, where the bot says it is on it while the call runs (`started`, `ask-started`), and one when the call ran, where it reports how it went (`finished`, `ask-decided`). A no gives one (`denied`, `ask-decided`); a no that stops the turn gives none, only a line the bot reads in its history the next time the person writes (`denied-and-stopped`). {{who}} is who decided, by name. -->

<!-- fragment: started -->

{{who}} approved: {{summary}}
It is running now.

<!-- fragment: finished -->

{{who}} approved a call, and it finished: {{summary}}
{{answer}}: {{result}}

<!-- fragment: it-ran -->

It ran

<!-- fragment: it-ran-and-failed -->

It ran and failed

<!-- fragment: denied -->

{{who}} denied: {{summary}}

<!-- fragment: denied-and-stopped -->

{{who}} denied and stopped your turn: {{summary}}

<!-- fragment: their-note -->

Their note: {{note}}

<!-- fragment: the-person -->
<!-- Who decided, when the name is unknown. -->

The person

<!-- fragment: ask-decided -->

This is what came of the approval card you raised. Tell the person in a sentence or two what happened, with the ids and details the answer gives. If it ran, check it as "Check before you report" says before you call it done. If it was denied, do not try the same thing another way: follow their note if they left one, or ask what they want instead. If it ran and failed, say why and what would fix it.

<!-- fragment: ask-started -->

They just approved the call you asked for, and Oppenheimer is running it now. Before it finishes, tell them in one short sentence, in your own voice and their language, that you are on it and what you are doing (for example: "On it, archiving those 25 now."). Do not say it is done, do not guess how it will go, and do not call any tool: how it went comes in your next turn, and you report it then.
