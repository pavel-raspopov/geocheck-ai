# UI Rules

Follows `context/ui-tokens.md`. Applies to the single-screen SPA.

## Tokens & CSS

- **Never hardcode hex/rgb in components** — CSS custom properties only (`var(--color-*)`).
- All numbers/coordinates/ε: `font-num` + `tabular-nums`. Zero exceptions.
- `:focus-visible` rings (2px `--color-accent`, 2px offset); never persistent focus rings.
- Motion: `prefers-reduced-motion` honored; only micro-transitions (opacity/transform, 150ms). No page-load kabooms.

## Layout

- Single screen (≥ 360px wide, no horizontal overflow): top bar (title + verdict status dot) → canvas card (upload zone until an image loads) → controls card (rule select, ε slider, «Проверить» button) → verdict card.
- Canvas: checkerboard background; detected segments `--color-accent`; labels `--color-info`; vertices as dots `--color-ink-3`.

## Components (registry: `context/ui-registry.md`)

- **Upload zone:** dashed hairline border, icon + «Перетащите файл или нажмите для выбора»; hover → accent border; keyboard accessible (is a button/input).
- **Rule select:** native `<select>` with the 4 rules (Russian labels); field style: `surface-2`, hairline, radius md.
- **ε slider:** `0.5 – 10`, step 0.5, default 3.0; current value in `font-num`; labeled «Погрешность ε».
- **Verdict card:** tone ok/danger/warn by status; `aria-live="polite"`; one line + deviation number.
- **Buttons:** primary = `--color-accent` fill, white text, hover `--color-accent-strong`; focus ring.

## Content & Copy

- Russian. Exact ТЗ strings are contract:
  - Soft error: `[Status: Error] Точка X не найдена на чертеже`
  - Fail (perpendicular): `Ошибка: Угол ABC на рисунке равен 84.12°, отклонение составляет 5.88°`
- Verdict prefixes: Success «Верно: …», Fail «Ошибка: …», Error «[Status: Error] …».

## Registry

Add every new component to `context/ui-registry.md` **before** building; run `/imprint` after new UI ships.
