# UI Tokens — «Чертёжная доска» (Drawing Board)

Light-first, clean technical-drawing feel: near-white ground, hairline borders, one ink-blue accent, tabular monospace numbers. Identity: a precise worksheet — readable, measured, calm. No gradients, no neon.

## Palette (semantic)

| Token           | Value     | Use                                           |
| --------------- | --------- | --------------------------------------------- |
| `bg`            | `#f6f8fb` | page ground                                   |
| `surface`       | `#ffffff` | cards, panels, canvas well                    |
| `surface-2`     | `#eef2f7` | nested rows, wells, hover                     |
| `surface-3`     | `#e2e8f0` | active wells, pressed                         |
| `border`        | `#cbd5e1` | hairlines                                     |
| `ink`           | `#0f172a` | primary text                                  |
| `ink-2`         | `#475569` | secondary text                                |
| `ink-3`         | `#94a3b8` | muted, captions                               |
| `accent`        | `#2563eb` | primary actions, detected lines, brand, focus |
| `accent-strong` | `#1d4ed8` | hover, emphasis                               |
| `accent-soft`   | `#dbeafe` | thin accent fills (selection, overlay)        |
| `ok`            | `#16a34a` | Success verdict                               |
| `warn`          | `#d97706` | near threshold, warning                       |
| `danger`        | `#dc2626` | Fail verdict, errors                          |
| `info`          | `#0284c7` | OCR labels info                               |

**Semantic rule:** green = Success, red = Fail/error, amber = near threshold. Never decorative.

## Typography

| Role    | Family              | Notes                                                   |
| ------- | ------------------- | ------------------------------------------------------- |
| UI      | `Inter` (or system) | labels, body, headings                                  |
| Numeric | `JetBrains Mono`    | **all** numbers, coordinates, ε — always `tabular-nums` |

Display scale `clamp(1.5rem, 3vw, 2.25rem)` — app title only; UI stays compact.

## Shape & Elevation

| Token           | Value                                                                 |
| --------------- | --------------------------------------------------------------------- |
| radius sm/md/lg | `8px / 10px / 12px`                                                   |
| shadow card     | `0 1px 2px rgb(15 23 42 / .08), 0 8px 20px -12px rgb(15 23 42 / .12)` |
| shadow pop      | `0 0 0 1px var(--border), 0 16px 36px -16px rgb(15 23 42 / .18)`      |
| hairline        | `1px solid var(--border)`                                             |

## Spacing

`4/8/12/16/24/32`. Card padding 16–20px; section gap 24px; page gutter `max(16px, calc((100vw - 1080px)/2))`.

## CSS Variables (`src/styles.css`)

```css
:root {
  --color-bg: #f6f8fb;
  --color-surface: #ffffff;
  --color-surface-2: #eef2f7;
  --color-surface-3: #e2e8f0;
  --color-border: #cbd5e1;
  --color-ink: #0f172a;
  --color-ink-2: #475569;
  --color-ink-3: #94a3b8;
  --color-accent: #2563eb;
  --color-accent-strong: #1d4ed8;
  --color-accent-soft: #dbeafe;
  --color-ok: #16a34a;
  --color-warn: #d97706;
  --color-danger: #dc2626;
  --color-info: #0284c7;
  --font-ui: 'Inter', ui-sans-serif, system-ui, sans-serif;
  --font-num: 'JetBrains Mono', ui-monospace, monospace;
  --radius-sm: 8px;
  --radius-md: 10px;
  --radius-lg: 12px;
}
```

## Fonts

Google Fonts Inter + JetBrains Mono (loaded in `index.html`, `font-display: swap`); system fallbacks keep the app fully usable offline.
