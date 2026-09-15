import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        card: {
          DEFAULT: 'var(--card)',
          foreground: 'var(--card-foreground)',
        },
        popover: {
          DEFAULT: 'var(--popover)',
          foreground: 'var(--popover-foreground)',
        },
        primary: {
          DEFAULT: 'var(--primary)',
          foreground: 'var(--primary-foreground)',
        },
        secondary: {
          DEFAULT: 'var(--secondary)',
          foreground: 'var(--secondary-foreground)',
        },
        muted: {
          DEFAULT: 'var(--muted)',
          foreground: 'var(--muted-foreground)',
        },
        accent: {
          DEFAULT: 'var(--accent)',
          foreground: 'var(--accent-foreground)',
        },
        destructive: {
          DEFAULT: 'var(--destructive)',
          foreground: 'var(--destructive-foreground)',
        },
        border: 'var(--border)',
        input: 'var(--input)',
        ring: 'var(--ring)',
        chart: {
          '1': 'var(--chart-1)',
          '2': 'var(--chart-2)',
          '3': 'var(--chart-3)',
          '4': 'var(--chart-4)',
          '5': 'var(--chart-5)',
        },
        sidebar: {
          DEFAULT: 'var(--sidebar)',
          foreground: 'var(--sidebar-foreground)',
          primary: 'var(--sidebar-primary)',
          'primary-foreground': 'var(--sidebar-primary-foreground)',
          accent: 'var(--sidebar-accent)',
          'accent-foreground': 'var(--sidebar-accent-foreground)',
          border: 'var(--sidebar-border)',
          ring: 'var(--sidebar-ring)',
        },
        // Brand primitives — see src/styles/globals.css for the full set.
        ink: {
          900: 'var(--ink-900)',
          600: 'var(--ink-600)',
          400: 'var(--ink-400)',
        },
        surface: {
          canvas: 'var(--surface-canvas)',
          card: 'var(--surface-card)',
          sunken: 'var(--surface-sunken)',
          hover: 'var(--surface-hover)',
          inverse: 'var(--surface-inverse)',
        },
      },
      fontFamily: {
        sans: 'var(--font-brand)',
      },
      fontSize: {
        xs: ['12px', { lineHeight: '1.35' }],
        sm: ['13px', { lineHeight: '1.4' }],
        base: ['14px', { lineHeight: '1.5' }],
        lg: ['16px', { lineHeight: '1.45' }],
        xl: ['20px', { lineHeight: '1.3' }],
        '2xl': ['24px', { lineHeight: '1.25' }],
      },
      letterSpacing: {
        normal: 'var(--tracking-brand)',
      },
      borderRadius: {
        sm: '6px',
        md: 'var(--radius-nav)', // 8px  — nav rows, inputs, small controls
        lg: '10px',
        xl: 'var(--radius-tile)', // 12px — app / brand icon tiles
        '2xl': 'var(--radius-card)', // 16px — cards, panels, sheets
        full: 'var(--radius-pill)',
      },
      // The system is flat: only genuinely floating layers get depth.
      boxShadow: {
        none: 'none',
        xs: 'none',
        sm: 'none',
        DEFAULT: 'none',
        md: 'none',
        lg: '0 10px 32px rgba(20, 20, 22, 0.14)',
        xl: '0 24px 60px rgba(20, 20, 22, 0.24)',
      },
    },
  },
  plugins: [],
};

export default config;
