# UI Registry

Update **after** every feature. Status: `planned` → `shipped`. When shipping, note the file path and key API.

| Component        | Status  | Purpose                                     | Notes                                                                                              |
| ---------------- | ------- | ------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `upload-zone`    | shipped | drag-and-drop + файловый выбор чертежа      | `src/ui/upload-zone.ts` `createUploadZone(onFile)`; клавиатурный доступ; ошибка для не-изображения |
| `rule-select`    | shipped | выбор правила из 4 (русские подписи)        | `src/ui/rule-select.ts` `createRuleSelect(value, onChange)`                                        |
| `epsilon-slider` | shipped | ε 0.5–10, шаг 0.5, default 3.0              | `src/ui/epsilon-slider.ts`; значение в `<output class="mono">`                                     |
| `canvas-view`    | shipped | рендер чертежа + оверлей линий/меток/вершин | `src/ui/canvas-view.ts`; mock (Фаза 1) → реальный пайплайн (Фазы 2–4); цвета из CSS-переменных     |
| `verdict-card`   | shipped | вердикт + отклонение, `aria-live`           | `src/ui/verdict-card.ts` `createVerdictCard` / `updateVerdictCard`                                 |
| `verdict-badge`  | shipped | статус Success/Fail/Error                   | `src/ui/verdict-badge.ts` `createVerdictBadge`; РУ: «Верно»/«Ошибка»                               |
| `demo-drawings`  | shipped | mock-данные пайплайна: идеал и 84.12°       | `src/mock/demo-drawings.ts`; 6 тестов; данные (не компонент)                                       |

Naming: CSS classes in `kebab-case`; no framework components (vanilla functions). New components require entry here + `/imprint` after shipping.

## Patterns — captured via `/imprint` (2026-09-12, Phase 1)

Baseline established by the Phase-1 components (`src/ui/*`, `src/styles.css`) — all values are tokens from `ui-tokens.md`, never raw hex:

| Property       | Pattern                                                                                                                                          |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Card container | `.card`: `--color-surface`, hairline `--color-border`, radius-lg, `--shadow-card`, padding 16                                                    |
| Field (inputs) | `--color-surface-2` bg, hairline border, radius-md, padding 8px 10px                                                                             |
| Primary button | `--color-accent` fill, text `--color-surface`, hover `--color-accent-strong`, radius-md, padding 10px 18px                                       |
| Upload zone    | dashed hairline border, `--color-surface-2`; hover/focus → `--color-accent`; drag → `--color-accent-soft`                                        |
| Badge          | pill (radius 999px), `--color-surface-2` bg, text `--color-ok`/`--color-danger`, 0.8125rem/600                                                   |
| Status dot     | 12px circle, `--color-ok`/`--color-danger`, `aria-hidden`                                                                                        |
| Canvas overlay | segments `--color-accent` 2px round; vertices `--color-ink-3` r=4; labels `--color-info` mono 16px — colors via `getComputedStyle` CSS variables |
| Text           | headlines 1.125rem/600; secondary 0.9375rem `--color-ink-2`; captions 0.8125–0.875rem `--color-ink-3`                                            |
| Spacing        | gaps 8/10; card gap 12; section margin-top 24                                                                                                    |
| Numbers        | `--font-num` + `tabular-nums` (`.mono`, `.verdict-meta`, canvas labels)                                                                          |
| Focus          | global `:focus-visible` ring (2px accent, 2px offset)                                                                                            |
