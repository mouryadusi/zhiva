import type { Config } from 'tailwindcss';

// ZHIVA design tokens.
// Warm neutrals + a single restrained accent + deep dark surfaces.
// These map to CSS variables defined in globals.css so accessibility
// presets (contrast, night mode, etc.) can override them at runtime.
const config: Config = {
  darkMode: ['class'],
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: 'rgb(var(--surface) / <alpha-value>)',
          raised: 'rgb(var(--surface-raised) / <alpha-value>)',
          sunken: 'rgb(var(--surface-sunken) / <alpha-value>)',
        },
        ink: {
          DEFAULT: 'rgb(var(--ink) / <alpha-value>)',
          muted: 'rgb(var(--ink-muted) / <alpha-value>)',
          faint: 'rgb(var(--ink-faint) / <alpha-value>)',
        },
        border: 'rgb(var(--border) / <alpha-value>)',
        accent: {
          DEFAULT: 'rgb(var(--accent) / <alpha-value>)',
          ink: 'rgb(var(--accent-ink) / <alpha-value>)',
        },
        positive: 'rgb(var(--positive) / <alpha-value>)',
        caution: 'rgb(var(--caution) / <alpha-value>)',
        critical: 'rgb(var(--critical) / <alpha-value>)',
      },
      fontFamily: {
        serif: ['var(--font-editorial)', 'Georgia', 'serif'],
        sans: ['var(--font-body)', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        'display-1': ['clamp(2.75rem, 8vw, 6rem)', { lineHeight: '0.98', letterSpacing: '-0.02em' }],
        'display-2': ['clamp(2rem, 5vw, 3.5rem)', { lineHeight: '1.02', letterSpacing: '-0.015em' }],
        'title-1': ['clamp(1.5rem, 3vw, 2rem)', { lineHeight: '1.15', letterSpacing: '-0.01em' }],
      },
      spacing: {
        18: '4.5rem',
        22: '5.5rem',
      },
      borderRadius: {
        card: '1.25rem',
      },
      boxShadow: {
        soft: '0 1px 2px rgb(0 0 0 / 0.04), 0 8px 24px -12px rgb(0 0 0 / 0.12)',
      },
      transitionTimingFunction: {
        editorial: 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
    },
  },
  plugins: [],
};

export default config;
