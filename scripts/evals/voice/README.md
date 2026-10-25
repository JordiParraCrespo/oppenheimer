# Voice eval

Does dictation write what the speaker meant, as well as Wispr Flow does?
Issue #393 and `product/next-steps/voice.md` ("How we know it works") ask
for this: about 30 real clips, the owner's voice among them, in Spanish,
English, Catalan and mixed, each with the text it should become.

The runner sends every clip through the real pipeline,
`POST /v1/voice/transcriptions`, on whatever API you point it at, the way the
console sends it. So it scores the deployment's speech provider, model and
polish together: change `VOICE_STT_MODEL`, the polish model or the polish
brief, restart, run again, compare.

## Recording a case

1. Dictate the clip with Wispr Flow running, and keep what it typed. That is
   the case's `wispr`.
2. Keep the same recording as a WAV. The API takes 16-bit PCM only, so convert
   whatever the recorder made:

   ```bash
   ffmpeg -i take.m4a -ar 16000 -ac 1 -c:a pcm_s16le scripts/evals/voice/clips/<id>.wav
   ```

   The console also cuts the silence at both ends before it uploads
   (`trimSilence` in `packages/frontend/web/src/dictation/lib/wav.ts`); this
   runner sends the file as it is, so trim long silences off yourself, or
   leave one in on purpose to test what the API makes of it.
3. Add the case to `cases.json` (start from `cases.example.json`): the text
   the speaker meant (`expected`, written the way they would have typed it,
   code in backticks), the names the screen would have shown (`vocabulary`),
   and the ones that must come out exactly (`names`).

Aim for the mix the console sees: short commands ("fix the login page"),
long rambling prompts with corrections ("no wait, actually…"), lists, spoken
punctuation, names of repositories and files, and sentences that switch
language halfway.

## Running it

```bash
node scripts/stack/stack.mjs up          # or any API with dictation set up
export VOICE_EVAL_TOKEN=…                # an API token with sessions:write
node scripts/evals/voice/run.mjs         # every case
node scripts/evals/voice/run.mjs --case es-login-loop
node scripts/evals/voice/run.mjs --grade scripts/evals/voice/reports/<file>.json
```

`VOICE_EVAL_API` points it elsewhere (default `http://localhost:3000/api`).
The workspace behind the token needs `voice_dictation` on.

It prints a table and writes the full answers to `reports/`:

- **WER**: word error rate against `expected`, lowercased and without
  punctuation or backticks, so it counts the words the person would have had
  to fix. Also for the raw transcript (the speech model alone, so the polish's
  share is the difference) and for Wispr Flow's text.
- **Names**: the share of `names` spelled exactly as written.
- **Latency**: the request, stop to text. The slice 0 target is 1.5 s at p50.

A case passes when its WER is no worse than Wispr Flow's on the same clip
(under 10 % when the case has no Wispr text) and every name is right.

## Privacy

`clips/`, `cases.json` and `reports/` are git-ignored: they are someone's
voice and what they said. Commit them only with the speakers' agreement.
Audio sent through the API is not stored there (`voice.md`, "Flag, privacy,
cost"), but it does reach the speech and polish providers the deployment
uses.
