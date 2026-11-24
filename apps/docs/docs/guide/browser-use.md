---
title: Bots using a browser
description: How a bot drives a browser of its own on one of your hosts (use_browser), turning it on with runner browser on, what the host needs, how the bot reads a page and acts on it, the permission card, and its limits.
sidebar_position: 5.6
---

A bot can use a website the way a person does: open it, read it, click, fill in a form. It does that in a browser of its own, on one of your [hosts](./hosts.md), through that host's runner. It is for sites that need a real browser: ones that run scripts, forms, and a dev server running on that host. It is off on every host until you turn it on there.

For anything that is not a web page (an app, a simulator), see [Bots using a computer](./computer-use.md).

## Turning it on

On the host itself, in a terminal:

- `runner browser on` lets your bots open a browser on this host. `runner browser off` stops them at once; nothing restarts.
- `runner browser` shows whether it is on and which browser a bot would get, or why there is none.

The setting lives in a file on the host (`~/.oppenheimer/browser.json`). Nothing in the console changes it, and Oppenheimer gives a bot no tool for it. One caveat: a host where you let bots run any program (`runner exec mode full`, or `runner` on its allowlist) lets a bot run this command too.

## What the host needs

Google Chrome, Chromium or Microsoft Edge, installed the usual way. On a Mac, Chrome in Applications is found. On Debian or Ubuntu, `sudo apt install chromium` is enough. No screen is needed and nothing appears on yours: the browser runs without a window. It needs no macOS permissions.

## The bot's own browser

Each bot gets one browser per host, with a profile of its own kept under the runner's folder (`~/.oppenheimer/state/browsers/<bot>`). It is **not your browser**: it has none of your logins, cookies, history or extensions, and what it does never shows in yours. It keeps its own cookies between tasks. It is closed when the bot closes it or when the runner stops, and one left unused for twenty minutes is closed the next time a bot browses. On a Mac, a browser the runner left behind when it stopped is closed the next time that bot opens one.

It browses **from the host**, so it reaches what that machine reaches: public sites, and also `localhost` and your local network. That is what makes it useful for a dev server on the host, and it is the reason the switch is yours.

## How a bot uses it

The bot has one tool, `use_browser`. Each call does one thing and comes back with the page: its title and address, and everything on it the bot can act on (links, buttons, fields), each with a short reference such as `e7`. The bot clicks or types by that reference, so it acts on the element it means and not on a spot of a picture. Its actions: open an address, read the page (with its text), take a picture, click, type into a field, press keys, scroll, go back, wait a few seconds, close.

Ask in the chat: "Open the pricing page of example.com and tell me what the team plan costs", or "Open localhost:5173 on build-02 and check the sign-up form works".

- **Permission.** Under **Approve for me** the first step raises a **Needs input** card. **Always allow for** its browser on that host lets the rest of the task run without a card per click. In **Settings → Permissions**, `use_browser` can be set to Allow, Ask or Off like any tool.
- **Models.** Every model can browse: the page comes back as text. A model that reads images (Claude, GPT, Grok) also gets a picture of the page with each step; GLM browses by text alone.
- **What you see.** The chat shows a line per step. Pictures of the page go to the model only; they are not stored and not shown in the chat.

## What a bot will not do

Its instructions tell it to never type a password, a sign-in code or a card number, to stop and tell you when a site asks it to sign in, to stop and ask you before anything that sends, buys, deletes or publishes, and to treat what a page says as information, never as instructions. A password already in a field is never read back to the bot.

## Limits

- It opens `http` and `https` addresses only: no files on the host, no browser settings pages.
- One page at a time. A link that would open a new tab opens in the same one; a site that opens a pop-up window by script is not followed.
- At most 150 elements of a page are listed, the ones on screen first, and the first 24 KB of its text on a read. A long page is scrolled and read again.
- No downloads, no file uploads, no extensions, and no saved passwords.
- Sites that block automated browsers may refuse it.
- A refusal names its reason: `BROWSER_001` it is off on the host, `BROWSER_002` no browser is installed, `BROWSER_003` the action does not fit the page (a reference from an earlier page, an address that is not a web page), `BROWSER_004` the browser or the page failed.
- An older runner cannot do this; update it from the host's menu (**Update runner**).
