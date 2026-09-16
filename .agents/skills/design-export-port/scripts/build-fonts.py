#!/usr/bin/env python3
"""
Turn the export's vendor font files into the subset woff2 the package ships.

A variable font (SF Pro: `opsz` 17–28, `wght` 1–1000) is instanced to static
faces at the weights and optical sizes the system uses; static OTFs (SF Mono)
are subset as they are. Everything is cut to Latin plus the punctuation and
keyboard glyphs the UI renders, then written as woff2: ~30KB a face instead
of 6MB.

    pip install fonttools brotli
    python3 build-fonts.py --src <export>/assets/fonts \
        --out packages/design-system/web/src/styles/fonts

Edit FACES for the families: (family output name, source file, opsz or None,
weight name, weight). Ship only what the system allows (600 ceiling, no
italics unless a screen uses one).

Imagery: the same idea for photographs, with Pillow —
    from PIL import Image; im = Image.open(p).convert('RGB')
    im.thumbnail((1400, 1400)); im.save(p[:-4] + '.webp', 'WEBP', quality=78, method=6)
"""
import argparse
import os

from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

FACES = [
    # (output family, source file, instance axes or None, weight name, weight)
    ("SF-Pro-Text", "SF-Pro.ttf", {"opsz": 17}, "Regular", 400),
    ("SF-Pro-Text", "SF-Pro.ttf", {"opsz": 17}, "Medium", 500),
    ("SF-Pro-Text", "SF-Pro.ttf", {"opsz": 17}, "Semibold", 600),
    ("SF-Pro-Display", "SF-Pro.ttf", {"opsz": 28}, "Regular", 400),
    ("SF-Pro-Display", "SF-Pro.ttf", {"opsz": 28}, "Medium", 500),
    ("SF-Pro-Display", "SF-Pro.ttf", {"opsz": 28}, "Semibold", 600),
    ("SF-Mono", "SFMono-Regular.otf", None, "Regular", 400),
    ("SF-Mono", "SFMono-Medium.otf", None, "Medium", 500),
    ("SF-Mono", "SFMono-Semibold.otf", None, "Semibold", 600),
]

# Latin-1, Latin Extended-A bits, general punctuation, the keyboard glyphs
# (⌘ ⌥ ⇧ ⌃ ⏎ ⌫), arrows, the middle dot and bullet, check, currency.
UNICODES = (
    "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,"
    "U+2000-206F,U+2074,U+20AC,U+2122,U+2190-2193,U+2212,U+2215,U+21E7,"
    "U+2303,U+2318,U+2325,U+2326,U+232B,U+2387,U+23CE,U+2026,U+00B7,U+2022,"
    "U+2713,U+FEFF,U+FFFD"
)


def subset_to_woff2(path, out):
    opts = subset.Options()
    opts.flavor = "woff2"
    opts.layout_features = ["*"]
    opts.name_IDs = ["*"]
    opts.notdef_outline = True
    opts.drop_tables += ["DSIG"]
    font = subset.load_font(path, opts)
    s = subset.Subsetter(opts)
    s.populate(unicodes=subset.parse_unicodes(UNICODES))
    s.subset(font)
    subset.save_font(font, out, opts)
    print(f"{os.path.basename(out)}  {os.path.getsize(out) // 1024} KB")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--tmp", default="/tmp/font-instances")
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)
    os.makedirs(a.tmp, exist_ok=True)
    for family, source, axes, wname, weight in FACES:
        src = os.path.join(a.src, source)
        if axes is not None:
            vf = TTFont(src)
            st = instancer.instantiateVariableFont(
                vf, {**axes, "wght": weight}, inplace=True, updateFontNames=False
            )
            src = os.path.join(a.tmp, f"{family}-{wname}.ttf")
            st.save(src)
        subset_to_woff2(src, os.path.join(a.out, f"{family}-{wname}.woff2"))


if __name__ == "__main__":
    main()
