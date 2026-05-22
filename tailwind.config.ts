import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',

        /* ── Brand color tokens ──────────────────────────────────── */
        brand: {
          DEFAULT: '#10D9A0',
          dim:     '#0DBF8C',
          dark:    '#0AA87A',
        },
        /* Backward-compat: neon.green now maps to brand primary */
        neon: {
          green: '#10D9A0',
          blue:  '#3B82F6',
          red:   '#EF4444',
        },
        /* CS2-specific semantic colors */
        tside:  '#F59E0B',
        ctside: '#3B82F6',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
      },
      boxShadow: {
        'card':     '0 1px 2px rgba(0,0,0,0.5), 0 0 0 1px hsl(var(--border))',
        'elevated': '0 4px 16px rgba(0,0,0,0.5), 0 0 0 1px hsl(var(--border))',
        'floating': '0 8px 32px rgba(0,0,0,0.7), 0 0 0 1px hsl(221,22%,22%)',
        'brand':    '0 0 24px rgba(16,217,160,0.15), 0 0 0 1px rgba(16,217,160,0.25)',
        'brand-sm': '0 0 12px rgba(16,217,160,0.12)',
      },
      animation: {
        'pulse-neon':    'pulse-neon 2s ease-in-out infinite',
        'slide-in':      'slide-in 0.3s ease-out',
        'fade-in':       'fade-in 0.2s ease-out',
        'reparse-fill':  'reparse-fill 30s ease-out forwards',
        'shimmer':       'shimmer 1.5s linear infinite',
        'fade-in-up':    'fade-in-up 0.35s ease-out both',
      },
      keyframes: {
        'pulse-neon': {
          '0%, 100%': { boxShadow: '0 0 8px rgba(16,217,160,0.3)' },
          '50%':       { boxShadow: '0 0 24px rgba(16,217,160,0.5)' },
        },
        'slide-in': {
          from: { transform: 'translateX(-100%)' },
          to:   { transform: 'translateX(0)' },
        },
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(-4px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in-up': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        'reparse-fill': {
          '0%':   { width: '0%' },
          '8%':   { width: '18%' },
          '20%':  { width: '38%' },
          '40%':  { width: '56%' },
          '65%':  { width: '72%' },
          '100%': { width: '85%' },
        },
        'shimmer': {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
    },
  },
  plugins: [],
}

export default config
