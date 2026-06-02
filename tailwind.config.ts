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
        input:  'hsl(var(--input))',
        ring:   'hsl(var(--ring))',

        /* ── Brand tokens ─────────────────────────────────────────── */
        brand: {
          DEFAULT: '#f43f5e',
          dim:     '#d03050',
          dark:    '#8a1f33',
        },
        /* Accent palette */
        pink:   '#f43f5e',
        purple: '#7047eb',
        teal:   '#14b8a6',
        'brand-bg':           '#07080e',
        'brand-card':         '#0f111e',
        'brand-purple':       '#7047eb',
        'brand-purple-hover': '#8862ff',
        'brand-cyan':         '#14b8a6',
        'brand-pink':         '#f43f5e',
        'brand-border':       '#1e2238',

        /* CS2-specific semantic colors */
        tside:  '#F59E0B',
        ctside: '#3B82F6',
      },
      fontFamily: {
        sans:    ['var(--font-inter)', 'Inter', 'system-ui', 'sans-serif'],
        display: ['var(--font-space)', 'Space Grotesk', 'sans-serif'],
        sora:    ['var(--font-sora)', 'Sora', 'sans-serif'],
        space:   ['var(--font-space)', 'Space Grotesk', 'sans-serif'],
        mono:    ['var(--font-mono-var)', 'JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'brand-gradient':  'linear-gradient(135deg, #f43f5e 0%, #7047eb 100%)',
      },
      boxShadow: {
        'brand':    '0 0 18px rgba(244,63,94,0.32)',
        'brand-lg': '0 0 30px rgba(244,63,94,0.4)',
        'purple':   '0 0 18px rgba(112,71,235,0.3)',
        'teal':     '0 0 18px rgba(20,184,166,0.25)',
      },
      animation: {
        'pulse-neon':    'pulse-neon 2s ease-in-out infinite',
        'slide-in':      'slide-in 0.3s ease-out',
        'fade-in':       'fade-in 0.2s ease-out',
        'reparse-fill':  'reparse-fill 30s ease-out forwards',
        'shimmer':       'shimmer 1.5s linear infinite',
        'fade-in-up':    'fade-in-up 0.35s ease-out both',
        'marquee':       'marquee 28s linear infinite',
        'glow':          'glow 2s ease-in-out infinite',
      },
      keyframes: {
        'pulse-neon': {
          '0%, 100%': { boxShadow: '0 0 8px rgba(244,63,94,0.4), 0 0 16px rgba(244,63,94,0.15)' },
          '50%':       { boxShadow: '0 0 20px rgba(244,63,94,0.6), 0 0 40px rgba(244,63,94,0.25)' },
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
        'marquee': {
          from: { transform: 'translateX(0)' },
          to:   { transform: 'translateX(-50%)' },
        },
        'glow': {
          '0%, 100%': { filter: 'drop-shadow(0 0 4px rgba(112, 71, 235, 0.4))' },
          '50%':       { filter: 'drop-shadow(0 0 12px rgba(112, 71, 235, 0.8))' },
        },
      },
    },
  },
  plugins: [],
}

export default config
