# Focus: how long a person can hold one task, and what it means for running many sessions

The owner asked on 2026-10-23 for research into human focus: how long we
should stay on one task, how to be more productive, and how to manage the
work Oppenheimer exists to multiply. Oppenheimer's promise is many agent
sessions on your own hosts at once; the person supervising them has one
attention span. This note gathers what is known about that attention, then
turns it into guidance for a person and into ideas for the console. It
decides nothing: an idea that is taken is written into the note that owns
its area and logged in `README.md`.

It builds on note 15 (`15-reviewing-at-agent-speed.md`), which covers
review as the bottleneck, and does not repeat its findings. Note 15 §9
said no hard data was found on batching notifications and focus; §1.5
below is that data.

Numbers a vendor published about itself are marked (v). Figures found only
in a book, an interview or press coverage, not a paper, are marked (u).
Sources are in §6.

## 1. What the evidence says

### 1.1 One deep stretch a day is the norm, and about 90 minutes is a ceiling for a stretch

- **Programmers get about one uninterrupted two-hour session a day.**
  Parnin and Rugaber recorded about 10,000 sessions from 85 programmers:
  after an interruption it took 10–15 minutes to start editing code again,
  and a resumption under a minute happened in only 10% of cases.
  Programmers rebuilt context by navigating through several places first,
  and some left a deliberate compile error behind as a bookmark.
- **Experts train in sessions of about an hour, and the day caps out near
  four.** Ericsson, Krampe and Tesch-Römer's deliberate-practice paper
  (1993) reports reduced benefit from practice beyond two hours a day and
  essentially none beyond four; laboratory studies of extended practice
  hold sessions to about an hour. The best performers' sessions are
  usually no longer than 90 minutes (u, press coverage of the same work).
- **"90 minutes" is not a biological law.** It is often tied to a
  90-minute ultradian rhythm in waking attention; that rhythm is
  established in sleep and only weakly in the day, so this note uses the
  practice data above, not the rhythm.

### 1.2 Breaks restore energy more than output

- **Micro-breaks (10 minutes or less) help how you feel, a little.** A
  meta-analysis of 22 samples (N = 2,335) found small effects on vigour
  (d = .36) and fatigue (d = .35), and no significant effect on
  performance overall (d = .16). Performance improved only on less
  demanding tasks, and longer breaks helped performance more; the authors
  suggest demanding work needs breaks longer than ten minutes.
- **Fixed breaks beat breaks you decide on, mostly on mood.** Biwer and
  colleagues (87 students, a real study day) compared self-chosen breaks
  with a 6-minute break every 24 minutes ("Pomodoro") and a 3-minute break
  every 12. People who chose their own breaks worked longer stretches and
  reported more fatigue and distraction; effort and work completed did not
  differ, so fixed breaks finished the same work in less time. Later
  studies are mixed.

### 1.3 A switch costs most at the switch, and a written next step removes much of the cost

- **Switching costs time, more for complex and unfamiliar work.**
  Rubinstein, Meyer and Evans (2001) measured the cost of each switch,
  which grows with task complexity and unfamiliarity. The often quoted
  "up to 40% of productive time" is Meyer's extrapolation, not a result
  of the paper.
- **The old task stays open in your head ("attention residue").** Leroy
  and Glomb (2018, four studies) found that an interrupted task leaves
  residue that lowers performance on the next one, and that a
  **ready-to-resume plan** — writing down where you were and what you
  meant to do next, under a minute's work — significantly reduces it.
- **Unfinished goals nag until they have a plan, not until they are
  done.** Masicampo and Baumeister (2011) found unfinished goals caused
  intrusive thoughts and worse performance on unrelated work; making a
  specific plan for the goal removed the effect.
- **Cues beat notes for resuming code.** Parnin and DeLine (2010): with
  either of two resumption cues (a timeline of recent activity or of
  recent code), developers completed resumed tasks at twice the rate of
  those using notes alone.

### 1.4 Interruptions are constant, and many are our own

- Microsoft's 2025 Work Trend Index (v) counts an interruption by a
  meeting, an email or a chat about every two minutes of core hours,
  about 275 a day.
- Gloria Mark's measurements (u, from her book and interviews): average
  attention on one screen fell from about 2½ minutes in 2004 to about 47
  seconds; people spend about 10½ minutes on a project before switching;
  getting back to the interrupted project takes about 25 minutes; and
  people interrupt themselves more than others interrupt them. Note 15
  §1.5 already declined the "23 minutes" figure for the same reason.

### 1.5 Batch notifications; do not switch them off

Fitz, Kushlev and colleagues (2019) randomised 237 people to phone
notifications as usual, batched hourly, batched three times a day, or none.
Three times a day lowered stress and raised well-being, attention and
sense of control; hourly made little difference; **none at all raised
anxiety and fear of missing out**. What helps is knowing when the batch
comes, not silence.

### 1.6 Supervising automation has a measurable ceiling

The closest science to "one person, many agents" is human supervision of
robots and drones.

- **Fan-out.** Olsen and Goodrich define a robot's **neglect time** (how
  long it can be ignored before it does badly) and **interaction time**
  (how long a person needs with it to bring it back to full speed).
  Olsen and Wood's fan-out — how many robots one person can keep going —
  is roughly the robot's activity time divided by its interaction time:
  longer neglect and shorter interaction raise it. Later work found that
  the *variance* of both, and the order the person serves them in, lower
  it.
- **Above about 70% busy, performance falls.** Cummings and Guerlain
  (2007) found that an operator's utilisation (share of time busy) above
  about 70% predicts significant performance decay. With more autonomy
  one operator supervised up to about 12 vehicles; with direct control,
  4–5. More autonomy also brought complacency and lost situation
  awareness.

### 1.7 Overseeing AI is its own kind of tired, and we misjudge our own speed

- **"AI brain fry".** A 2026 BCG study in Harvard Business Review (about
  1,500 US workers) found about 14% reported mental fog, headaches and
  slower decisions from heavy use or oversight of AI tools; they reported
  33% more decision fatigue and more minor (11%) and major (39%) errors,
  and more intent to quit. Software engineering was among the most
  affected functions. Its authors separate it from burnout: it comes from
  the load of supervising AI and checking its output.
- **People cannot feel their own productivity.** METR's randomised trial
  (2025; 16 experienced open-source developers, 246 tasks in their own
  repositories) found AI-allowed tasks took 19% longer, while the
  developers believed afterwards that AI had made them 20% faster. METR
  warns against generalising from early-2025 tools and mature codebases;
  the lasting lesson is the gap between feeling and measurement.
- **No study yet measures how many coding agents one developer can run
  well.** Practitioner write-ups agree that load grows with the number of
  agents more than with the difficulty of each (u). §1.6 is the best
  stand-in until there is one.

## 2. Guidance for a person running sessions

The one place the evidence becomes advice, as a working day. Nothing here
is a product rule.

1. **Two kinds of time.** One or two *focus blocks* of 60–90 minutes for
   the work only you can do — specifying tasks, design, deep review — and
   shorter *triage passes* between them where you serve the sessions that
   are waiting (§1.1).
2. **Brief well, then leave it.** A session's neglect time is set when it
   starts: a clear goal, how to tell it is done (a test, a check), and a
   permission mode that does not stop it for routine steps (§1.6).
3. **Four or so active sessions.** A session that works alone for 20
   minutes and then needs 4 minutes of you gives a fan-out of about six;
   staying under 70% busy brings that to about four, and a session that
   asks every five minutes supports one or two. The lever is how long a
   session can be left and how fast you re-enter it, not how many you
   open (§1.6).
4. **One line before every switch** — where it is, what is next — and on
   return, start from a cue of what happened, not from memory (§1.3).
5. **Batch the pings.** Look at waiting sessions at set times, between
   blocks, rather than on every notification; do not turn them off
   entirely (§1.5).
6. **Fixed breaks, kept rather than decided each time:** short between
   blocks, 15 minutes or more after heavy review or design. The evidence
   does not pick 25, 50 or 90 minutes for you (§1.2).
7. **Trust measurements over feelings** about which way of working is
   faster (§1.7).

## 3. Ideas for Oppenheimer

Each idea names the finding behind it and what only Oppenheimer can do,
because it owns the hosts, the sessions and their event log. Following
note 15's rule: algorithmic first, an agent only where a rule cannot
read.

1. **Where you left off.** When a person leaves a session (switches to
   another, closes the tab), the console offers one optional line, "Next
   step", stored on the session. Coming back shows that line above the
   terminal with a cue built from the event log: the agent's state now,
   what changed since you left (turns, files touched, checks run) and the
   last thing you typed. Algorithmic: every field is already in the log;
   a summary by an agent only if the change list is long. *Behind it:
   §1.3 (ready-to-resume plans; cues over notes).*
2. **Batched Needs input.** A setting for how waiting sessions reach you:
   *at once* (today), *in batches* at times you choose or at the end of a
   focus block, or *only blocking* (a session that has waited longer than
   a threshold breaks through). In between, the rail shows a count, not a
   toast. *Behind it: §1.4, §1.5.* Channels (`next-steps/channels.md`)
   and mobile push (`next-steps/0.5-mobile.md`) would obey the same
   setting.
3. **Focus blocks.** §1.1 and §1.5 suggest a protected block in which
   batched notifications wait and one task is in front of the person.
   Open: is that a kind of event on Plan's calendar, and what does the
   block's end show? Owner: `versions/mvp/20-plan-calendar.md`.
4. **A fan-out meter.** From session events the control plane can compute,
   per person, each session's neglect time (time running alone before it
   needs input) and interaction time (from opening a waiting session to
   the agent running again), and the person's utilisation over the last
   hour. Stats (`versions/mvp/23-plan-milestones-stats-accounts.md` §4)
   shows the trend; the sessions rail warns once when utilisation passes
   70%. Purely arithmetic. *Behind it: §1.6, and §1.7's point that
   people misjudge their own load.*
5. **Longer neglect time.** §1.6 says fan-out rises with how long a
   session can be left alone. Open: what at session start (a
   done-condition in the brief, a suggested permission mode) lengthens it,
   and should Stats show which sessions ask most? Owners:
   `versions/mvp/19-plan-tasks-and-goals.md` §5 and
   `versions/mvp/23-plan-milestones-stats-accounts.md` §4.
6. **Out of hours.** §1.5, with note 15 §1.7 on work spilling out of
   hours. Open: should sessions that keep running out of hours hold their
   notifications to the next batch?
7. **Measuring ways of working.** §1.7 says people misjudge their own
   speed. Open: should Stats compare a person's time from task start to
   merged PR across ways of working (sessions in parallel, permission
   mode, focus blocks)? Owner: `versions/mvp/23-plan-milestones-stats-accounts.md` §4.

Ideas 1, 2 and 4 are small, rest on data the runner's state detection
(`versions/mvp/02-runner.md` §9) and the event log already produce, and
answer the strongest evidence. They are the suggested first slice.

## 4. Open questions

1. Is "Next step" asked for on every switch, or only after a session has
   been open long enough to have context worth saving?
2. Where does the batching setting live: per person, per project, per
   focus block? Per person first seems enough.
3. Does the fan-out meter count bots (`versions/mvp/25-bots.md`) whose
   Needs input cards also wait on the person?
4. What does a person see when the meter says they are over capacity: a
   warning only, or an offer to pause the session that has waited
   longest?

## 5. What this note does not cover

Sleep, exercise, meetings and team practices beyond one person. All of
them affect focus more than any console can; none is something
Oppenheimer owns.

## 6. Sources

- Parnin and Rugaber, resumption strategies for interrupted programming
  tasks: <https://link.springer.com/article/10.1007/s11219-010-9104-9>
- Parnin and DeLine, evaluating cues for resuming interrupted
  programming tasks (CHI 2010):
  <https://www.microsoft.com/en-us/research/publication/evaluating-cues-for-resuming-interrupted-programming-tasks/>
- Ericsson, Krampe and Tesch-Römer (1993), *Psychological Review*, as
  read in: <https://www.greaterwrong.com/posts/8EmPhoxgSXGSdq4Cb/epistemic-spot-check-the-role-of-deliberate-practice-in-the>
- Albulescu et al. (2022), "Give me a break!", *PLOS ONE* 17(8)
  e0272460: <https://doaj.org/article/c6f37b6ba159469296b2cb968b65505f>
- Biwer et al. (2023), Pomodoro and self-regulated breaks, *British
  Journal of Educational Psychology* 93(2):
  <https://pubmed.ncbi.nlm.nih.gov/36859717/>
- Rubinstein, Meyer and Evans (2001), as summarised by the APA:
  <https://www.apa.org/topics/research/multitasking>
- Leroy and Glomb (2018), *Organization Science*, ready-to-resume plan:
  <https://www.washington.edu/news/2018/01/16/task-interrupted-a-plan-for-returning-helps-you-move-on/>
- Masicampo and Baumeister (2011), *Journal of Personality and Social
  Psychology* 101(4), 667–683: <https://psychology.wfu.edu/e-j-masicampo/>
- Microsoft Work Trend Index 2025, as reported:
  <https://www.unleash.ai/artificial-intelligence/microsoft-employees-are-interrupted-every-2-minutes-how-can-ai-help-us-re-focus-on-the-work-that-matters/>
- Gloria Mark, *Attention Span* (2023): <https://www.brainhq.com/books/attention-span/>
- Fitz, Kushlev et al. (2019), batching notifications, *Computers in
  Human Behavior*: <https://scholars.duke.edu/publication/1402953>,
  summary: <https://work21.gatech.edu/?p=402>
- Olsen and Goodrich (2003), metrics for human-robot interaction:
  <https://faculty.cs.byu.edu/~mike/mikeg/papers/OlsenGoodrichPERMIS2003.pdf>
- Olsen and Wood (2004), fan-out (CHI 2004):
  <https://hci.rwth-aachen.de/materials/conferences/CHI2004/1p231.pdf>
- Scheduling and team size in multirobot supervisory control (CMU):
  <https://ri.cmu.edu/?p=9754>
- Cummings and Mitchell, automation architecture and operator capacity:
  <https://dspace.mit.edu/bitstream/1721.1/90289/1/CummingsMitchell_AST06.pdf>;
  review citing Cummings and Guerlain (2007):
  <https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2016.00568/epub>
- Bedard, Kropp et al. (2026), "When Using AI Leads to Brain Fry",
  *Harvard Business Review*:
  <https://www.ebsco.com/articles/life-sciences/e9c45d90-41e8-51ca-aea4-6bb26cf4ee06/when-using-ai-leads-to-brain-fry>;
  interview: <https://www.unleash.ai/artificial-intelligence/your-employees-have-ai-brain-fry-its-affecting-your-business-bcg-on-fixing-the-problem/>
- METR (2025), early-2025 AI and experienced open-source developers:
  <https://metr.org/blog/2025-07-10-early-2025-ai-experienced-os-dev-study/>;
  coverage: <https://the-decoder.com/ai-coding-can-make-developers-slower-even-if-they-feel-faster/>
- Practitioner reports on parallel agents (u):
  <https://xeve.io/blog/parallel-coding-agents-cognitive-cost>

Not verified against the primary paper: Ericsson's figures (secondary
read), Mark's figures (book and interviews), the Work Trend Index
methodology, the BCG study's methods, and Cummings and Guerlain's 70%
and 12-vehicle conditions (abstracts only).
