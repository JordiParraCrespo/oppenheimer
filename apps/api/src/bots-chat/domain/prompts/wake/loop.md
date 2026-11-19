<!-- A loop (`/loop`): what each run tells the bot, the rules every run carries (the first, which the person's /loop opens, included: its first line is `turn/slash-command.md`), and how a loop ended, as a line outside any turn that the person sees and the bot reads in its history. -->

<!-- fragment: run -->
<!-- {{shown}} counts the setting turn as run 1. -->

Run {{shown}} of your loop, which the person set with /loop to run {{cadence}}: {{prompt}}

<!-- fragment: nobody-wrote -->

Nobody wrote to you: this turn exists for the loop. Read what your last runs found, so you report what is new.

<!-- fragment: do-it-now -->

Do it now and report briefly what you found; if nothing changed since your last run, say so in a line.

<!-- fragment: schedule-the-next -->
<!-- Only a self-paced loop is told this. -->

Before you finish, call schedule_loop with when to run next, 1 to {{max}} minutes from now: sooner while things are changing, later when they are quiet. If you do not, the loop ends.

<!-- fragment: quiet -->
<!-- How a loop's run stays silent about a blocker the person already knows: it fills `repeated-blocker.md`. -->

call end_loop and say why in one line

<!-- fragment: when-it-has-served -->

When the loop has served its purpose (what it watches finished, or it cannot go on without the person), call end_loop and say why.

<!-- fragment: when-you-choose -->
<!-- The cadence of a self-paced loop; the ones below are a loop's on an interval. -->

when you choose

<!-- fragment: every-minute -->

every minute

<!-- fragment: every-minutes -->

every {{count}} minutes

<!-- fragment: every-hour -->

every hour

<!-- fragment: every-hours -->

every {{count}} hours

<!-- fragment: every-day -->

every day

<!-- fragment: every-days -->

every {{count}} days

<!-- fragment: end-line -->

{{ended}} (after {{runs}} runs): {{prompt}}

<!-- fragment: ended-cleared -->

The person stopped your loop

<!-- fragment: ended-expired -->

Your loop ran for 3 days and expired

<!-- fragment: ended-stopped -->

Your loop stopped because a run of it failed or was stopped

<!-- fragment: ended-ended -->

Your loop ended: its last run did not call schedule_loop
