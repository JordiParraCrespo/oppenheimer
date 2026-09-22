# Symbols Nerd Font Mono

`SymbolsNerdFontMono-Regular.woff2` is the symbols-only face from
[Nerd Fonts](https://github.com/ryanoasis/nerd-fonts), MIT licensed.

It is here because a terminal is the product's primary surface and coding
agents draw their turns with glyphs no stock monospace face carries: the
Powerline and private-use ranges, box drawing, and the marks Claude Code and
Codex open a turn with. A machine without a Nerd Font installed renders each
of those as a substitute mark, which is what put a stray glyph at the start of
every agent line.

Only the private-use ranges are claimed by the `@font-face` rule
(`unicode-range` in `styles/globals.css`), so the browser downloads this file
only when a session actually prints one, and every other character still comes
from the platform's own monospace face.
