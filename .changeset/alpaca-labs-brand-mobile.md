---
"@oppenheimer/design-system-mobile": minor
---

Rebrand the mobile design system onto the Alpaca Labs visual language.

The brand's monochrome-first, flat vocabulary is mirrored in the bare-HSL form
NativeWind needs: three neutral inks over white and warm off-white surfaces,
hairlines flattened to solid values because React Native cannot composite an
rgba border token, the three brand radii plus the pill, and the warm near-black
dark canvas with its own chrome, surface and hairline ramp.

Colours are now declared with `<alpha-value>`, so opacity modifiers like
`bg-primary/90` resolve — previously Tailwind dropped them silently.
