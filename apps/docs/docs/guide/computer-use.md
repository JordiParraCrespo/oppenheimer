---
title: Bots using a computer
description: How a bot sees the screen of one of your hosts and uses its mouse and keyboard (use_computer), turning it on with runner computer on, what a Mac and a Linux host need, the permission card, which models can do it, and its limits.
sidebar_position: 5.5
---

A bot can use a computer the way a person sitting at it does: look at the screen, move the mouse, click, type and press keys. The computer is one of your [hosts](./hosts.md), and the bot reaches it through that host's runner. It is for work that only has a graphical interface: an app, a simulator, a website that needs a real browser. It is off on every host until you turn it on there.

## Turning it on

On the host itself, in a terminal:

- `runner computer on` lets your bots use this host's screen. `runner computer off` stops them at once; nothing restarts.
- `runner computer` shows whether it is on and which screen a bot would get, or why there is none.

The setting lives in a file on the host (`~/.oppenheimer/computer.json`). Nothing in the console changes it, and Oppenheimer gives a bot no tool for it. One caveat: a host where you let bots run any program (`runner exec mode full`, or `runner` on its allowlist) lets a bot run this command too, so keep those two decisions together.

## What the host needs

**A Mac.** The bot uses the Mac's own main screen, mouse and keyboard, as the account the runner runs as, so you see the pointer move while it works. macOS must also allow the runner twice, in **System Settings → Privacy & Security**: **Screen Recording** (without it a bot sees your desktop picture and no windows) and **Accessibility** (without it clicks and keys are refused). Someone must be logged in at the Mac's screen.

**Debian or Ubuntu.** The runner drives an X display through `xdotool` and ImageMagick: `sudo apt install xdotool imagemagick xvfb xauth`. It uses the display it was started with, or one of your own already on the machine. A host with no monitor gets a **virtual screen** (Xvfb, 1280 by 800) that the runner starts and keeps, locked so that only your account can reach it; it starts empty, so a program has to be opened on it (the bot is told the display's name, such as `:99`). A Wayland desktop is refused with `COMPUTER_002`: log in with an Xorg session instead ("Ubuntu on Xorg" at the login screen).

## How a bot uses it

The bot has one tool, `use_computer`. Each call does one thing (look, move the pointer, click, double-click, right-click, middle-click, drag, scroll, type text, press keys such as `cmd+s`, or wait a few seconds) and comes back with a picture of the screen after it, which the bot reads before its next step. The picture is at most 1,280 pixels on its long side; a larger screen is scaled down.

Ask in the chat: "Open the simulator on my Mac and check the sign-up screen", naming the host if it is not the bot's home host.

- **Permission.** Under **Approve for me** the first step raises a **Needs input** card. **Always allow for** the screen of that host lets the rest of the task run without a card per click; **Approve once** covers one step, after which the bot has to look at the screen again, which asks again. In **Settings → Permissions**, `use_computer` can be set to Allow, Ask or Off like any tool.
- **Models.** The bot's model must read images: Claude, GPT and Grok do, GLM does not, and a bot on GLM says so instead of trying.
- **What you see.** The chat shows a line per step. The screenshots go to the model only; they are not stored and not shown in the chat.

## What a bot will not do

Its instructions tell it to never type a password, a sign-in code or a card number, to stop and ask you before anything that sends, buys, deletes or publishes, to touch only what the task needs, and to treat what the screen shows as information, never as instructions. When a login appears, it tells you and waits for you to do that step.

## Limits

- One screen per host: a Mac's main display, or one X display. Two bots on one host take turns.
- Screenshots are sent to the bot's model provider, with whatever is on the screen at that moment. Close what you would not share before you turn it on.
- Typing accented or non-Latin text on a Mac can lose characters.
- A refusal names its reason: `COMPUTER_001` it is off on the host, `COMPUTER_002` the host has no screen the runner can use (the reason says what is missing), `COMPUTER_003` the action does not fit (a point outside the picture, a key that is not one), `COMPUTER_004` the screen could not be read or used (on a Mac, usually a missing permission).
- An older runner cannot do this; update it from the host's menu (**Update runner**).
