const { hairlineWidth } = require("nativewind/theme");

/**
 * Oppenheimer brand theme for NativeWind. Mirrors
 * `packages/design-system/web/tailwind.config.ts` so a component's classes mean
 * the same thing on both platforms. Tokens live in `./global.css`.
 *
 * Colours are declared with `<alpha-value>` so opacity modifiers
 * (`bg-primary/90`) actually resolve — plain `hsl(var(--x))` silently drops them.
 */

/** Build an `hsl(var(--token) / <alpha-value>)` colour entry. */
const token = (name) => `hsl(var(--${name}) / <alpha-value>)`;

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
    "./registry/**/*.{ts,tsx}",
    "../../packages/design-system/mobile/src/**/*.{ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        border: token("border"),
        input: token("input"),
        ring: token("ring"),
        background: token("background"),
        foreground: token("foreground"),
        primary: {
          DEFAULT: token("primary"),
          foreground: token("primary-foreground"),
        },
        secondary: {
          DEFAULT: token("secondary"),
          foreground: token("secondary-foreground"),
        },
        destructive: {
          DEFAULT: token("destructive"),
          foreground: token("destructive-foreground"),
        },
        muted: {
          DEFAULT: token("muted"),
          foreground: token("muted-foreground"),
        },
        accent: {
          DEFAULT: token("accent"),
          foreground: token("accent-foreground"),
        },
        popover: {
          DEFAULT: token("popover"),
          foreground: token("popover-foreground"),
        },
        card: {
          DEFAULT: token("card"),
          foreground: token("card-foreground"),
        },

        // ---- Brand primitives ----------------------------------------------
        ink: {
          900: token("ink-900"),
          600: token("ink-600"),
          400: token("ink-400"),
        },
        surface: {
          canvas: token("surface-canvas"),
          card: token("surface-card"),
          sunken: token("surface-sunken"),
          hover: token("surface-hover"),
          inverse: token("surface-inverse"),
        },
        "border-subtle": token("border-subtle"),
        "border-default": token("border-default"),
        "border-strong": token("border-strong"),
        "accent-blue": token("accent-blue"),
        "accent-cyan": token("accent-cyan"),
        "accent-pink": token("accent-pink"),
        "accent-purple": token("accent-purple"),
        "data-up": token("data-up"),
        "data-down": token("data-down"),
        "data-line": token("data-line"),
        "data-line-compare": token("data-line-compare"),
        "data-track": token("data-track"),
        "track-off": token("track-off"),
        "status-active": token("status-active"),
        "status-paused": token("status-paused"),
        "status-ended": token("status-ended"),
        "status-draft": token("status-draft"),
        "on-inverse": token("on-inverse"),
        "on-inverse-muted": token("on-inverse-muted"),
        "status-active-bg": token("status-active-bg"),
        "status-paused-bg": token("status-paused-bg"),
        "status-ended-bg": token("status-ended-bg"),
        "status-draft-bg": token("status-draft-bg"),
        "focus-ring": token("focus-ring"),
      },

      // The brand ships four sizes: 12 / 13 / 14 for UI, 24 for headings.
      fontSize: {
        xs: ["12px", { lineHeight: "16px" }],
        sm: ["13px", { lineHeight: "18px" }],
        base: ["14px", { lineHeight: "21px" }],
        lg: ["16px", { lineHeight: "23px" }],
        xl: ["20px", { lineHeight: "26px" }],
        "2xl": ["24px", { lineHeight: "30px" }],
      },

      // Three intentional radii, plus the pill used by every CTA.
      borderRadius: {
        sm: 6,
        md: 8, // nav rows, inputs, small controls
        lg: 10,
        xl: 12, // app / brand icon tiles
        "2xl": 16, // cards, panels, sheets
        "3xl": 20,
        full: 9999,
      },

      borderWidth: {
        hairline: hairlineWidth(),
      },
    },
  },
  plugins: [],
};
