---
name: GeoCheck AI
description: Модуль верификации геометрических чертежей — светлая «чертёжная доска» с ink-синим акцентом.
colors:
  bg: '#f6f8fb'
  surface: '#ffffff'
  surface-2: '#eef2f7'
  surface-3: '#e2e8f0'
  border: '#cbd5e1'
  ink: '#0f172a'
  ink-2: '#475569'
  ink-3: '#94a3b8'
  accent: '#2563eb'
  accent-strong: '#1d4ed8'
  accent-soft: '#dbeafe'
  ok: '#16a34a'
  warn: '#d97706'
  danger: '#dc2626'
  info: '#0284c7'
typography:
  display:
    fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif'
    fontSize: 'clamp(1.5rem, 3vw, 2.25rem)'
    fontWeight: 600
    lineHeight: 1.15
  headline:
    fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif'
    fontSize: '1.125rem'
    fontWeight: 600
    lineHeight: 1.3
  body:
    fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif'
    fontSize: '0.9375rem'
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif'
    fontSize: '0.75rem'
    fontWeight: 500
    letterSpacing: '0.06em'
  numeric:
    fontFamily: 'JetBrains Mono, ui-monospace, monospace'
    fontSize: '0.875rem'
    fontWeight: 500
    fontFeature: 'tabular-nums'
rounded:
  sm: '8px'
  md: '10px'
  lg: '12px'
spacing:
  xs: '4px'
  sm: '8px'
  md: '12px'
  lg: '16px'
  xl: '24px'
  2xl: '32px'
components:
  card:
    backgroundColor: '{colors.surface}'
    textColor: '{colors.ink}'
    rounded: '{rounded.lg}'
    padding: '16px'
---

# Design System: GeoCheck AI

> Канонический источник токенов: `context/ui-tokens.md`. Этот файл — портативное зеркало;
> при расхождении побеждает `ui-tokens.md`.

## Обзор (Creative North Star: «Чертёжная доска»)

GeoCheck AI выглядит как аккуратный чертёжный лист: светлый почти-белый фон, hairline-границы,
один ink-синий акцент и табулярные моноширинные цифры. Спокойно, измеримо, читаемо — без
градиентов, без неона, без «AI-фиолетового».

**Ключевые характеристики:**

- Светлая тема (единственная)
- Один акцент (ink-синий) со строгой семантикой
- Все числа — JetBrains Mono с `tabular-nums`
- Hairline `1px`-границы + лёгкие ambient-тени; ничего не светится
- Холст с шахматной подложкой = «бумага инженера»

## Цвета

| Роль            | Значение  | Как использовать                                   |
| --------------- | --------- | -------------------------------------------------- |
| `bg`            | `#f6f8fb` | фон страницы                                       |
| `surface`       | `#ffffff` | карточки, панели, холст                            |
| `surface-2`     | `#eef2f7` | вложенные строки, wells, hover                     |
| `surface-3`     | `#e2e8f0` | активные wells, нажатия                            |
| `border`        | `#cbd5e1` | hairline-границы                                   |
| `ink`           | `#0f172a` | основной текст                                     |
| `ink-2`         | `#475569` | вторичный текст                                    |
| `ink-3`         | `#94a3b8` | подписи, muted                                     |
| `accent`        | `#2563eb` | главные действия, распознанные линии, бренд, focus |
| `accent-strong` | `#1d4ed8` | hover, выделение                                   |
| `accent-soft`   | `#dbeafe` | тонкие заливки акцента (выбор, оверлей)            |
| `ok`            | `#16a34a` | вердикт Success                                    |
| `warn`          | `#d97706` | около порога, предупреждение                       |
| `danger`        | `#dc2626` | вердикт Fail, ошибки                               |
| `info`          | `#0284c7` | OCR-метки, вспомогательная информация              |

**Семантическое правило.** Зелёный = Success, красный = Fail/ошибка, янтарный = около порога.
Никогда для декора.

## Типографика

| Роль  | Семейство            | Примечания                                           |
| ----- | -------------------- | ---------------------------------------------------- |
| UI    | `Inter` (или system) | подписи, текст, заголовки                            |
| Числа | `JetBrains Mono`     | **все** числа, координаты, ε — всегда `tabular-nums` |

- Display-масштаб `clamp(1.5rem, 3vw, 2.25rem)` — только заголовок приложения; интерфейс компактен.
- Код/инлайн: JetBrains Mono `0.875rem`.

## Формы и тени

| Токен             | Значение                                                              |
| ----------------- | --------------------------------------------------------------------- |
| radius `sm/md/lg` | `8px / 10px / 12px`                                                   |
| shadow card       | `0 1px 2px rgb(15 23 42 / .08), 0 8px 20px -12px rgb(15 23 42 / .12)` |
| shadow pop        | `0 0 0 1px var(--border), 0 16px 36px -16px rgb(15 23 42 / .18)`      |
| hairline          | `1px solid var(--border)`                                             |

## Отступы

Сетка `4/8/12/16/24/32`. Пэддинг карточек 16–20px; секционный зазор 24px; гуттер страницы `max(16px, calc((100vw - 1080px)/2))`.

## Компоненты

- **Зона загрузки:** пунктирная hairline-граница, иконка + «Перетащите файл или нажмите для выбора»; hover → граница accent.
- **Селект правила:** `<select>` на 4 правила (русские подписи), style как у input: surface-2, hairline, радиус md.
- **Слайдер ε:** 0.5–10, шаг 0.5, default 3.0; значение справа в mono.
- **Холст:** шахматная подложка; распознанные отрезки — `accent`, буквы — `info`, вершины — точки `ink-3`.
- **Карточка вердикта:** тон ok/danger/warn, `aria-live="polite"`, одна строка + число отклонения.
- **Кнопка:** primary — заливка `accent`, белый текст, hover `accent-strong`; focus-кольцо 2px `accent` смещением 2px.

## Правила «До / Нельзя»

**До:** использовать токены (`var(--color-*)`) везде; числа — `font-num` + `tabular-nums`; вердикты только с обоснованием; компактные заголовки.

**Нельзя:** второй акцент или декоративные цвета; градиенты, свечение, цветные тени; raw hex в компонентах; фееричные анимации загрузки.

### Именованные правила

**The One-Accent Rule.** Ink-синий — единственный акцент; его редкость и есть смысл — он отмечает действия и распознанное.

**The Semantic-Only Rule.** Зелёный/янтарный/красный — только со смыслом вердикта (Success/near-threshold/Fail).
