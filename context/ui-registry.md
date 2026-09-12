# UI Registry

Update **after** every feature. Status: `planned` → `shipped`. When shipping, note the file path and key API.

| Component        | Status  | Purpose                                     | Notes                                |
| ---------------- | ------- | ------------------------------------------- | ------------------------------------ |
| `upload-zone`    | planned | drag-and-drop + файловый выбор чертежа      | Phase 1; keyboard accessible         |
| `rule-select`    | planned | выбор правила из 4 (русские подписи)        | Phase 1                              |
| `epsilon-slider` | planned | ε 0.5–10, шаг 0.5, default 3.0              | Phase 1; значение в mono             |
| `canvas-view`    | planned | рендер чертежа + оверлей линий/меток/вершин | Phase 1 (mock) → 2–4 (real pipeline) |
| `verdict-card`   | planned | вердикт + отклонение, `aria-live`           | Phase 1                              |
| `verdict-badge`  | planned | статус Success/Fail/Error                   | Phase 1                              |

Naming: CSS classes in `kebab-case`; no framework components (vanilla functions). New components require entry here + `/imprint` after shipping.
