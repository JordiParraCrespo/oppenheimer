import type { Config } from 'tailwindcss';

/**
 * Legacy Tailwind v3-style preset. The apps run Tailwind v4 and read the theme
 * from `src/styles/globals.css` (`@theme inline`); this file only mirrors the
 * same tokens for a consumer still on a JS config.
 */
const config: Config = {
  darkMode: ['class', '[data-theme="dark"]'],
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: 'var(--canvas)',
        background: 'var(--background)',
        foreground: 'var(--fg)',
        fg: {
          DEFAULT: 'var(--fg)',
          muted: 'var(--fg-muted)',
          subtle: 'var(--fg-subtle)',
          inverted: 'var(--fg-inverted)',
        },
        card: { DEFAULT: 'var(--card)', foreground: 'var(--fg)' },
        popover: { DEFAULT: 'var(--popover)', foreground: 'var(--fg)' },
        primary: {
          DEFAULT: 'var(--primary)',
          hover: 'var(--primary-hover)',
          active: 'var(--primary-active)',
          foreground: 'var(--primary-fg)',
        },
        link: 'var(--link)',
        control: {
          DEFAULT: 'var(--control)',
          hover: 'var(--control-hover)',
          active: 'var(--control-active)',
          fg: 'var(--control-fg)',
        },
        field: {
          DEFAULT: 'var(--field)',
          border: 'var(--field-border)',
          placeholder: 'var(--field-placeholder)',
        },
        border: {
          DEFAULT: 'var(--border)',
          subtle: 'var(--border-subtle)',
          strong: 'var(--border-strong)',
        },
        ring: 'var(--ring)',
        success: 'var(--success)',
        warning: 'var(--warning)',
        danger: 'var(--danger)',
        info: 'var(--info)',
        sidebar: {
          DEFAULT: 'var(--sidebar)',
          foreground: 'var(--sidebar-fg)',
          muted: 'var(--sidebar-muted)',
          border: 'var(--sidebar-border)',
        },
        term: {
          bg: 'var(--term-bg)',
          fg: 'var(--term-fg)',
          dim: 'var(--term-dim)',
          border: 'var(--term-border)',
          accent: 'var(--term-accent)',
          success: 'var(--term-success)',
          warning: 'var(--term-warning)',
          danger: 'var(--term-danger)',
        },
      },
      fontFamily: {
        sans: 'var(--font-sans)',
        display: 'var(--font-display)',
        mono: 'var(--font-mono)',
      },
      fontSize: {
        micro: ['11px', { lineHeight: '1.27', letterSpacing: '0.02em' }],
        xs: ['12px', { lineHeight: '1.33', letterSpacing: '-0.003em' }],
        sm: ['13px', { lineHeight: '1.38', letterSpacing: '-0.006em' }],
        operate: ['14px', { lineHeight: '1.4', letterSpacing: '-0.008em' }],
        base: ['15px', { lineHeight: '1.47', letterSpacing: '-0.011em' }],
        lg: ['17px', { lineHeight: '1.47', letterSpacing: '-0.016em' }],
        xl: ['21px', { lineHeight: '1.24', letterSpacing: '-0.011em' }],
        '2xl': ['28px', { lineHeight: '1.15', letterSpacing: '-0.016em' }],
        '3xl': ['40px', { lineHeight: '1.1', letterSpacing: '-0.021em' }],
        '4xl': ['52px', { lineHeight: '1.07', letterSpacing: '-0.024em' }],
        '5xl': ['76px', { lineHeight: '1.04', letterSpacing: '-0.028em' }],
      },
      borderRadius: {
        xs: '6px',
        sm: '10px',
        md: '14px',
        lg: '18px',
        xl: '28px',
        pill: '980px',
        full: '980px',
      },
      boxShadow: {
        none: 'none',
        sm: 'none',
        DEFAULT: 'none',
        md: 'none',
        popover: 'var(--shadow-popover)',
        modal: 'var(--shadow-modal)',
        lg: 'var(--shadow-popover)',
        xl: 'var(--shadow-modal)',
      },
      transitionDuration: {
        instant: '80ms',
        fast: '140ms',
        base: '220ms',
        slow: '400ms',
      },
    },
  },
  plugins: [],
};

export default config;
