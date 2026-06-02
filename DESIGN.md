# Rivalize — Design System Reference
**Version 4.0 · Dark Modern / Neon Tokyo**

> This document is the single source of truth for Rivalize's visual identity. Share it with any design tool (Google Stitch, Figma AI, etc.) to generate UI that matches the existing system.

---

## 1. Brand Identity

**Product**: Rivalize — AI-powered CS2 demo analysis and coaching platform
**Tagline**: "Know Your Enemy"
**Audience**: Competitive CS2 teams, semi-pro players
**Aesthetic**: Dark dashboard, neon accents, esports-grade data density

**Two-color brand identity**:
- **Violet** `#7C6BFF` — primary UI accent (buttons, focus states, interactive highlights)
- **Hot Pink** `#ff2d78` — brand identity (CTAs, logos, gradient hero text)

---

## 2. Color Tokens

### Surface Scale (always dark — no light mode)

| Token | Hex | Usage |
|-------|-----|-------|
| `--bg` | `#090910` | Page background |
| `--panel` | `#0B0B12` | Sidebar, nav panels |
| `--card` | `#111119` | Cards, primary elevated surface |
| `--card-2` | `#16161F` | Secondary card, inputs |
| `--elevated` | `#1B1B26` | Hover states, dropdowns |

### Text Hierarchy

| Token | Value | Usage |
|-------|-------|-------|
| `--text` | `#F0F0F6` | Primary text |
| `--muted` | `rgba(240,240,246,0.56)` | Secondary text, labels |
| `--faint` | `rgba(240,240,246,0.32)` | Tertiary, placeholders, metadata |

### Borders

| Token | Value | Usage |
|-------|-------|-------|
| `--border` | `rgba(255,255,255,0.065)` | Default card/panel border |
| `--border-2` | `rgba(255,255,255,0.11)` | Stronger borders, inputs |
| `--border-strong` | `rgba(124,107,255,0.22)` | Accent-tinted borders |
| `--hairline` | `rgba(255,255,255,0.035)` | Subtle row hover bg |
| `--track` | `rgba(255,255,255,0.05)` | Progress tracks |

### Brand Accent (Violet — Primary)

| Token | Value | Usage |
|-------|-------|-------|
| `--accent` | `#7C6BFF` | Buttons, focus rings, active states |
| `--accent-deep` | `#5A45E6` | Button gradient bottom, hover |
| `--accent-fg` | `#ffffff` | Text on accent backgrounds |
| `--accent-soft` | `rgba(124,107,255,0.13)` | Subtle accent bg (icons, tags) |
| `--accent-line` | `rgba(124,107,255,0.30)` | Accent-tinted borders, dividers |

### Semantic / CS2 Colors

| Token | Hex | Usage |
|-------|-----|-------|
| `--signal` | `#2DE3CE` | Cyan — AI insights, positive signals |
| `--win` | `#36D49E` | Match victory |
| `--loss` | `#FF5C6C` | Match loss, errors |
| `--ct` | `#5B8DEF` | Counter-Terrorist side |
| `--tside` | `#E6A53D` | Terrorist side |

### Raw Brand Palette (Tailwind + CSS)

```css
pink:   #ff2d78   /* Brand CTA */
purple: #9b1dff   /* Brand secondary */
teal:   #00ffc8   /* Signal / success */

brand.DEFAULT: #ff2d78
brand.dim:     #cc0060
brand.dark:    #880040
```

### Gradient

```css
--grad: linear-gradient(135deg, #ff2d78 0%, #9b1dff 100%)
```

---

## 3. Typography

### Font Families

| Role | Font | Weights | CSS Variable |
|------|------|---------|--------------|
| **UI / Body** | Inter | 400, 500, 600, 700 | `--font-inter` / `var(--font-ui)` |
| **Display / Headers** | Space Grotesk | 400, 500, 600, 700 | `--font-space` / `var(--font-display)` |
| **Display Alt** | Sora | 400, 600, 700, 800 | `--font-sora` |
| **Code / Data / Mono** | JetBrains Mono | 400, 500, 600 | `--font-mono` |

All from Google Fonts. Body defaults to Inter. Section titles use Space Grotesk. Stats/data labels use JetBrains Mono.

### Key Type Specs

```css
/* Hero H1 */
font-family: Space Grotesk;
font-weight: 600;
font-size: clamp(46px, 6vw, 78px);
line-height: 0.98;
letter-spacing: -0.03em;

/* Section H2 */
font-family: Space Grotesk;
font-weight: 600;
font-size: clamp(30px, 4vw, 44px);
line-height: 1.04;
letter-spacing: -0.025em;

/* Section labels / eyebrows */
font-family: JetBrains Mono;
font-size: 11px;
font-weight: 500;
letter-spacing: 0.06em;
text-transform: uppercase;
color: var(--faint);

/* Card headers */
font-family: Space Grotesk;
font-size: 13px;
font-weight: 600;
letter-spacing: 0.04em;
color: rgba(255,255,255,0.75);

/* UI body */
font-family: Inter;
font-size: 13–14px;
line-height: 1.6–1.7;
color: var(--text);

/* Stats / data */
font-family: JetBrains Mono;
font-feature-settings: 'tnum','zero';
font-size: 33px;
font-weight: 500;
letter-spacing: -0.02em;
```

### Text Effects

```css
/* Pink → Purple gradient text (hero headlines) */
.text-gradient {
  background: linear-gradient(135deg, #ff2d78 0%, #9b1dff 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

/* Teal → Purple gradient */
.text-gradient-teal {
  background: linear-gradient(90deg, #00ffc8, #9b1dff);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

/* Neon glow text effects */
.neon-text    { text-shadow: 0 0 20px rgba(255,45,120,0.6), 0 0 40px rgba(255,45,120,0.3); }
.neon-pink    { text-shadow: 0 0 8px currentColor; }
.neon-cyan    { text-shadow: 0 0 8px currentColor; }
```

---

## 4. Spacing & Shape

```css
--pad:    22px   /* Default panel padding */
--gap:    18px   /* Component gap */
--radius: 15px   /* Default border-radius for panels/cards */

/* Component-specific radii */
buttons:    11px (default), 10px (sm), 9px (inputs)
cards/panels: 15–16px
badges:     4px (rounded)
icons:      8–11px
```

---

## 5. Component Specifications

### Panel System

The core surface component. All cards, dashboards, modals use this.

```css
.rv-panel {
  background: linear-gradient(180deg, rgba(255,255,255,0.016), transparent 120px), var(--card);
  border: 1px solid var(--border);
  border-radius: 15px;
  position: relative;
  overflow: hidden;
}

/* Subtle top sheen line */
.rv-panel::before {
  content: '';
  position: absolute;
  top: 0; left: 20px; right: 20px;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.09) 28%, rgba(255,255,255,0.09) 72%, transparent);
  z-index: 1;
}
```

**Glass variant** (used on overlays, sticky nav):
```css
.rv-glass {
  background: color-mix(in srgb, var(--card) 68%, transparent) !important;
  backdrop-filter: blur(20px) saturate(1.3);
  box-shadow: 0 1px 2px rgba(0,0,0,0.35), 0 18px 44px -26px rgba(0,0,0,0.8);
}
```

**Insight/signal variant** (AI insights, key stats):
```css
.rv-insight {
  border-color: color-mix(in srgb, var(--signal) 24%, transparent);
  background:
    radial-gradient(480px 250px at 8% -24%, color-mix(in srgb, var(--signal) 11%, transparent), transparent 60%),
    linear-gradient(180deg, color-mix(in srgb, var(--signal) 2.5%, var(--card)), var(--card));
}
```

**Hero variant** (featured/accent panels):
```css
.rv-hero {
  background:
    radial-gradient(820px 380px at 92% -40%, color-mix(in srgb, var(--accent) 14%, transparent), transparent 62%),
    radial-gradient(620px 300px at 4% -30%, color-mix(in srgb, var(--loss) 5%, transparent), transparent 60%),
    linear-gradient(180deg, color-mix(in srgb, var(--accent) 3%, var(--card)), var(--card));
  border-color: color-mix(in srgb, var(--accent) 18%, var(--border));
}
```

### Corner Ticks

Subtle L-shaped corner accents for premium panels:
```css
.rv-tick-tl { top: 10px; left: 10px; border-top: 1.5px solid var(--accent-line); border-left: 1.5px solid var(--accent-line); }
.rv-tick-br { bottom: 10px; right: 10px; border-bottom: 1.5px solid var(--accent-line); border-right: 1.5px solid var(--accent-line); }
```

### Accent Lines (gradient dividers)

```css
.accent-line-pink   { height: 2px; background: linear-gradient(90deg, rgba(255,45,120,0.8), rgba(255,45,120,0.15) 60%, transparent); }
.accent-line-purple { height: 2px; background: linear-gradient(90deg, rgba(155,29,255,0.8), rgba(155,29,255,0.15) 60%, transparent); }
.accent-line-teal   { height: 2px; background: linear-gradient(90deg, rgba(0,255,200,0.8), rgba(0,255,200,0.15) 60%, transparent); }
```

### Buttons

**Primary CTA (Accent/Violet)**:
```css
.rv-btn-accent {
  background: linear-gradient(180deg, var(--accent), var(--accent-deep));
  color: #ffffff;
  box-shadow: 0 1px 0 rgba(255,255,255,0.22) inset, 0 6px 18px -8px rgba(124,107,255,0.7);
  height: 40px; padding: 0 17px; border-radius: 11px;
  font-size: 13px; font-weight: 600; letter-spacing: -0.005em;
}
.rv-btn-accent:hover { filter: brightness(1.07); transform: translateY(-1px); }
.rv-btn-accent:active { transform: translateY(0); }
```

**Brand CTA (Hot Pink / Neon)**:
```css
.neon-cta {
  background: linear-gradient(135deg, #ff2d78, #c41f5f);
  color: white;
  border: 1px solid rgba(255,45,120,0.4);
  box-shadow: 0 0 16px rgba(255,45,120,0.35), 0 4px 12px rgba(0,0,0,0.3);
  font-family: Space Grotesk; font-weight: 600; letter-spacing: 0.02em;
}
.neon-cta:hover { filter: brightness(1.08); box-shadow: 0 0 24px rgba(255,45,120,0.5); transform: translateY(-1px); }
```

**Signal/Cyan Secondary**:
```css
.rv-btn-signal {
  background: color-mix(in srgb, var(--signal) 13%, transparent);
  color: var(--signal);
  border: 1px solid color-mix(in srgb, var(--signal) 32%, transparent);
}
```

**Ghost**:
```css
.rv-btn-ghost {
  background: var(--card-2);
  color: var(--text);
  border: 1px solid var(--border-2);
}
.rv-btn-ghost:hover { border-color: var(--accent-line); background: var(--elevated); }
```

**Component Button variants (shadcn-style)**:
- `default` / `neon` — Hot pink primary `#ff2d78`
- `secondary` — Frosted white `bg-white/7`
- `ghost` — Text only, subtle hover
- `destructive` — Red tinted
- `outline` — Bordered, transparent bg

**Sizes**: `sm` (28px), `default` (36px), `lg` (44px), `xl` (48px), `icon` (32px)

### Badges

All badges share: `rounded px-2 py-0.5 text-[11px] font-semibold`

| Variant | Text | Border | Background |
|---------|------|--------|------------|
| `default` | white | none | `#ff2d78` |
| `secondary` | `rgba(255,255,255,0.55)` | `rgba(255,255,255,0.09)` | `rgba(255,255,255,0.06)` |
| `neon` | `#00ffc8` | `rgba(0,255,200,0.28)` | `rgba(0,255,200,0.1)` |
| `success` | `#00c864` | `rgba(0,200,100,0.28)` | `rgba(0,200,100,0.12)` |
| `warning` | `#ffaa00` | `rgba(255,165,0,0.3)` | `rgba(255,165,0,0.14)` |
| `destructive` | `#ff4040` | `rgba(255,64,64,0.28)` | `rgba(255,64,64,0.12)` |
| `blue` | blue-400 | `rgba(59,130,246,0.25)` | `rgba(59,130,246,0.1)` |
| `purple` | `#a46dff` | `rgba(155,29,255,0.28)` | `rgba(155,29,255,0.1)` |
| `tside` | amber-400 | `rgba(245,158,11,0.3)` | `rgba(245,158,11,0.1)` |
| `ctside` | blue-400 | `rgba(59,130,246,0.3)` | `rgba(59,130,246,0.1)` |

### Stat Cards (left-border accent)

```css
.stat-card-pink   { border-left: 3px solid rgba(255,45,120,0.5); }
.stat-card-purple { border-left: 3px solid rgba(155,29,255,0.5); }
.stat-card-teal   { border-left: 3px solid rgba(0,255,200,0.5); }
.stat-card-amber  { border-left: 3px solid rgba(255,224,74,0.5); }
.stat-card-red    { border-left: 3px solid rgba(255,64,64,0.5); }
.stat-card-green  { border-left: 3px solid rgba(0,200,100,0.5); }
.stat-card-blue   { border-left: 3px solid rgba(59,130,246,0.5); }
```

### Row Hover

Used in tables and list items:
```css
.rv-row { transition: background .14s ease, box-shadow .14s ease; }
.rv-row:hover {
  background: var(--hairline);
  box-shadow: inset 2px 0 0 var(--accent);  /* left accent line */
}
```

### Inputs

```css
background: var(--card-2);
border: 1px solid var(--border);
border-radius: 9px;
height: 36px; padding: 0 12px;
color: var(--text);
font-size: 13px;
transition: border-color .14s ease;

:focus { border-color: var(--accent-line); }
::placeholder { color: var(--faint); }
```

### Glow Effects

```css
.glow-pink   { box-shadow: 0 0 16px rgba(255,45,120,0.35), 0 0 40px rgba(255,45,120,0.12); }
.glow-cyan   { box-shadow: 0 0 16px rgba(0,255,204,0.3), 0 0 40px rgba(0,255,204,0.1); }
.glow-yellow { box-shadow: 0 0 14px rgba(255,224,74,0.35); }
```

### Skeleton / Loading Shimmer

```css
.skeleton {
  background: linear-gradient(90deg, hsl(var(--muted)) 25%, rgba(255,45,120,0.08) 50%, hsl(var(--muted)) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s linear infinite;
}
```

---

## 6. Layout

### App Shell

```
┌─────────────────────────────────────────────────────────────┐
│  Fixed BG layer (z-0): violet radial + cyan radial + --bg   │
├──────────┬──────────────────────────────────┬───────────────┤
│ SIDEBAR  │  TOPBAR (sticky, 54px)           │  SOCIAL PANEL │
│ (220px,  ├──────────────────────────────────┤  (280px,      │
│ desktop) │  MAIN CONTENT                    │  desktop)     │
│          │  (scrollable, flex-1)            │               │
├──────────┴──────────────────────────────────┴───────────────┤
│  MOBILE BOTTOM NAV (mobile only)                            │
├──────────────────────────────────────────────────────────────┤
│  FEEDBACK BUBBLE (fixed bottom-right)                       │
└──────────────────────────────────────────────────────────────┘
```

**Background gradient** (full-page, fixed):
```css
background:
  radial-gradient(1400px 900px at 84% -16%, rgba(124,107,255,0.12), transparent 60%),
  radial-gradient(800px 500px at 2% 6%, rgba(45,227,206,0.04), transparent 58%),
  var(--bg);
```

### Topbar

- Height: ~54px, sticky top
- Glass background + 14px blur
- Left accent line: `height: 2px; background: linear-gradient(90deg, var(--accent), fade-out 70%)`
- Contains: page title, command palette (⌘K), notifications, user menu

### Sidebar

- Width: 220px (desktop), slides in on mobile
- Background: `var(--panel)` + right border `var(--border)`
- Nav groups with Lucide icons
- Collapsible with 0.14s ease transition
- Active item: accent left border `2px solid var(--accent)`

---

## 7. Animations

| Class | Duration | Effect |
|-------|----------|--------|
| `.animate-fade-in` | 200ms ease-out | Fade + slide down 4px |
| `.animate-fade-in-up` | 350ms ease-out | Fade + slide up 8px |
| `.animate-fade-in-up-delay-1/2/3` | +80/160/240ms | Staggered list entrance |
| `.animate-slide-in` | 300ms ease-out | Slide from left (sidebar) |
| `.animate-shimmer` | 1.5s linear infinite | Loading skeleton |
| `.animate-pulse-neon` | 2s ease-in-out infinite | Pink glow pulse on CTAs |
| `.animate-marquee` | 28s linear infinite | Horizontal ticker |
| `.animate-reparse-fill` | 30s ease-out | Demo parse progress bar |

**Base interaction timing**: `transition: all 0.14s ease` (buttons, cards, inputs)
**Hover lift**: `transform: translateY(-1px)`
**Active press**: `transform: scale(0.98)` or `translateY(0)`

---

## 8. Page Routes & Sections

### Marketing Landing Page (`/`)

- Sticky glassmorphism nav with logo + links
- Hero: 2-col grid (headline + AI chat widget demo)
- Stats band: 4-col grid with mono numbers
- Feature cards: 3-col grid with icon + title + description
- Product screenshot window with violet glow
- Final CTA panel with radial gradient
- Footer with links

### App Pages (authenticated, `/dashboard`, etc.)

| Route | Purpose |
|-------|---------|
| `/dashboard` | Team overview, recent demos, win/loss chart |
| `/opponents` | Opponent team scouting, demo library |
| `/opponents/pro-demos` | Pro team demo browser |
| `/my-team` | Team roster, stats, maps |
| `/ai-coach` | AI chat coaching interface |
| `/playbook` | Strategy playbook editor |
| `/veto` | Map veto simulator |
| `/lineups` | Utility lineup library |
| `/prep` | Pre-match prep briefs |
| `/improve` | Personal improvement tracker |
| `/profile`, `/settings`, `/friends` | Account management |

---

## 9. Design Principles

1. **Always dark** — No light mode. Dark surfaces with neon accents.
2. **Data density** — Dashboard-grade layouts. Small text, tight spacing acceptable.
3. **Hierarchy via color, not size** — Use accent/signal/muted to separate layers, not just font size.
4. **Neon restraint** — Glows and neon effects are used sparingly on CTAs and key data points only, not everywhere.
5. **Glass for depth** — Glassmorphism (`backdrop-filter: blur`) used on nav, modals, overlays — not bulk content.
6. **Micro-motion** — 0.14s ease for all interactive states. Hover lifts, active presses, fade-ins on content load.
7. **Esports context** — CS2-specific semantic colors (CT blue, T amber, signal cyan for AI) are first-class tokens.
8. **Typography contrast** — Space Grotesk for bold display. Inter for readability. JetBrains Mono for all numeric/data.

---

## 10. Component File Map

```
components/
├── ui/
│   ├── button.tsx       — Button variants (7 variants, 6 sizes)
│   ├── card.tsx         — Card / CardHeader / CardContent / CardFooter
│   ├── badge.tsx        — Badge (11 variants incl. tside/ctside)
│   ├── input.tsx        — Form input
│   ├── label.tsx        — Form label
│   └── empty-state.tsx  — Empty state placeholder
└── layout/
    ├── Sidebar.tsx       — Collapsible left nav
    ├── TopBar.tsx        — Sticky top bar + notifications
    ├── MobileMenu.tsx    — Mobile hamburger nav
    ├── SocialPanel.tsx   — Right-side friends panel (desktop)
    ├── CommandPalette.tsx — ⌘K search overlay
    └── PageHeader.tsx    — Page title component
```

---

## 11. Tech Stack (for AI code generation context)

| Layer | Tech |
|-------|------|
| Framework | Next.js 15.5 (App Router) |
| Styling | Tailwind CSS 4.1 + custom CSS variables |
| UI Primitives | Radix UI (Dialog, Tabs, Select, Switch, etc.) |
| Icons | Lucide React |
| Variant Utility | class-variance-authority (cva) |
| Class Merge | clsx + tailwind-merge (`cn()`) |
| Fonts | Google Fonts (Inter, Space Grotesk, Sora, JetBrains Mono) |
| Language | TypeScript |

---

## 12. Quick Reference: Key CSS Variables

```css
/* Paste into any design tool's CSS context */
:root {
  --bg: #090910;
  --panel: #0B0B12;
  --card: #111119;
  --card-2: #16161F;
  --elevated: #1B1B26;

  --border: rgba(255,255,255,0.065);
  --border-2: rgba(255,255,255,0.11);
  --hairline: rgba(255,255,255,0.035);

  --text: #F0F0F6;
  --muted: rgba(240,240,246,0.56);
  --faint: rgba(240,240,246,0.32);

  --accent: #7C6BFF;
  --accent-deep: #5A45E6;
  --accent-soft: rgba(124,107,255,0.13);
  --accent-line: rgba(124,107,255,0.30);

  --signal: #2DE3CE;
  --win: #36D49E;
  --loss: #FF5C6C;
  --ct: #5B8DEF;
  --tside: #E6A53D;

  --pink: #ff2d78;
  --purple: #9b1dff;
  --teal: #00ffc8;

  --grad: linear-gradient(135deg, #ff2d78 0%, #9b1dff 100%);

  --radius: 15px;
  --pad: 22px;
  --gap: 18px;
}
```
