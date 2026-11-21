---
title: Voice
description: How dictation and bots' voice notes are heard and spoken, and the Voice tab of Settings → Model providers that picks the speech-to-text provider and model, the voice-note provider, model and voice, and the transcript polish.
sidebar_position: 5.7
---

# Voice

Voice is two things: **dictation**, the mic in the console's fields and the voice notes your bots are sent on WhatsApp, heard as text; and **voice notes** your bots send back, a short reply spoken. Both run on the providers in **Settings → Model providers**.

## Providers that hear and speak

| Provider | Hears | Speaks | How |
| --- | --- | --- | --- |
| ChatGPT | Yes | No | **Connect ChatGPT** (the same sign-in bots use) |
| OpenAI | Yes | Yes | API key |
| Groq | Yes | No | API key; voice only, no bot runs on it |
| ElevenLabs | Yes | Yes | API key; voice only, no bot runs on it |
| This server | If its admin set one up | If its admin set one up | Nothing to add |

## The Voice tab

Settings → Model providers has two tabs: **Providers**, the keys, and **Voice**, which has three rows. Each starts on **Automatic**, which uses the first provider you have, in the order of the table above.

- **Speech to text**: what hears dictation and the voice notes your bots are sent, and the model where the provider offers one (OpenAI: GPT-4o Transcribe, GPT-4o mini Transcribe, Whisper; Groq: Whisper large v3 Turbo or v3; ElevenLabs: Scribe).
- **Voice notes**: what your bots speak in, its model, and the voice. OpenAI offers its own set of voices (Alloy, Nova, Shimmer and the rest). ElevenLabs offers a few premade voices and **A voice from my library…**, which takes the ID of any voice in your ElevenLabs account, a cloned one included.
- **Transcript polish**: the provider and model that tidy what was heard into writing (fillers gone, names spelled as the screen shows them), or **Off** to keep the words exactly as heard. Automatic uses the ChatGPT sign-in or OpenAI key that heard the clip, else the server's own model if it has one.

A choice is saved as you pick it.

## When a provider fails

The provider you picked is tried first. If its key was removed or it fails, the next provider you have answers, in its own default model and voice, so dictation and voice notes keep working. A provider that says it is rate limited is not retried elsewhere: wait a moment and try again.

## Limits

- One setting per workspace: every bot speaks in the same voice.
- A voice note says at most 600 characters, about 40 seconds; a longer reply is sent as text.
- Telegram voice notes are not available yet.
