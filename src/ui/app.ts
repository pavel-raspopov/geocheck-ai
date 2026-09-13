import type { Rule, VerifyResult } from '../pipeline/types';
import { verify } from '../pipeline/verify';
import { analyzeDrawing, type PipelineResult } from '../pipeline/run';
import { DEMO_DRAWINGS } from '../mock/demo-drawings';
import { createCanvasCard, renderCanvas, type CanvasOverlay } from './canvas-view';
import { createEpsilonSlider } from './epsilon-slider';
import { fileToRawImage } from './image-input';
import { createRuleSelect } from './rule-select';
import { createUploadZone } from './upload-zone';
import { createVerdictCard, setVerdictPlaceholder, updateVerdictCard } from './verdict-card';
import { formatTimings } from './types';
import type { AppState } from './types';
import { createInitialState } from './types';

/**
 * Сборка одноэкранного SPA (Фаза 4): DOM строится один раз, динамика обновляется
 * по состоянию. Без загруженного изображения — демо-режим (мгновенный verify()
 * на графе демо-сцены); с изображением полный пайплайн запускает кнопка
 * «Проверить», а смена правила/ε пересчитывает только verify() на сохранённом
 * графе (OCR/OpenCV заново не запускаются).
 */
export function createApp(root: HTMLElement): void {
  const state: AppState = createInitialState();

  const topbar = document.createElement('header');
  topbar.className = 'topbar';
  const title = document.createElement('h1');
  title.className = 'title';
  title.textContent = 'GeoCheck AI';
  const subtitle = document.createElement('p');
  subtitle.className = 'subtitle';
  subtitle.textContent = 'Модуль верификации геометрических чертежей';
  const statusDot = document.createElement('span');
  statusDot.className = 'status-dot';
  statusDot.setAttribute('aria-hidden', 'true');
  topbar.append(title, subtitle, statusDot);

  const uploadZone = createUploadZone(onFile);
  const { card: canvasCard, canvas } = createCanvasCard(uploadZone);
  const verdictCard = createVerdictCard();

  const ruleControl = createRuleSelect(state.rule, onRuleChange);
  const epsilonControl = createEpsilonSlider(state.epsilon, onEpsilonChange);
  const scenarioSelect = createScenarioSelect();
  const verifyButton = document.createElement('button');
  verifyButton.type = 'button';
  verifyButton.className = 'btn-primary';
  verifyButton.textContent = 'Проверить';
  verifyButton.addEventListener('click', () => {
    void runPipeline();
  });

  const controls = document.createElement('section');
  controls.className = 'card controls-card';
  const controlsHeadline = document.createElement('h2');
  controlsHeadline.className = 'headline';
  controlsHeadline.textContent = 'Параметры проверки';
  controls.append(controlsHeadline, ruleControl, epsilonControl, scenarioSelect, verifyButton);

  root.append(topbar, canvasCard, controls, verdictCard);
  refreshCanvas();
  runDemo();

  function createScenarioSelect(): HTMLElement {
    const label = document.createElement('label');
    label.className = 'field';
    const caption = document.createElement('span');
    caption.className = 'field-label';
    caption.textContent = 'Демо-сцена';
    const select = document.createElement('select');
    select.id = 'scenario-select';
    select.className = 'field-input';
    for (const demo of DEMO_DRAWINGS) {
      const option = document.createElement('option');
      option.value = demo.id;
      option.textContent = demo.label;
      select.append(option);
    }
    select.value = state.demo.id;
    select.addEventListener('change', () => {
      const demo = DEMO_DRAWINGS.find((d) => d.id === select.value);
      if (demo) {
        update({ demo });
      }
    });
    label.append(caption, select);
    return label;
  }

  function update(patch: Partial<AppState>): void {
    Object.assign(state, patch);
    refreshCanvas();
    refreshVerdict();
  }

  function refreshCanvas(): void {
    renderCanvas(canvas, state.demo, state.imageUrl, overlay());
  }

  function overlay(): CanvasOverlay | null {
    if (!state.analysis) {
      return null;
    }
    return {
      segments: state.analysis.segments,
      vertices: state.analysis.vertices,
      labels: state.analysis.labels,
    };
  }

  /** Демо-режим: мгновенный verify() на графе демо-сцены (без CV/OCR). */
  function runDemo(): void {
    applyVerdict(verify({ graph: state.demo.graph, rule: state.rule, epsilon: state.epsilon }), []);
  }

  /** Пересчёт вердикта: полный анализ не повторяем — граф уже построен. */
  function refreshVerdict(): void {
    if (state.analysis) {
      const verdict = verify({
        graph: state.analysis.graph,
        rule: state.rule,
        epsilon: state.epsilon,
      });
      applyVerdict(
        verdict,
        softNotes(state.analysis.unboundLabels),
        formatTimings(state.analysis.timings),
      );
    } else if (!state.imageUrl) {
      runDemo();
    }
    // imageUrl && !analysis → ждём «Проверить»; карточку не трогаем.
  }

  /** Полный анализ загруженного изображения (кнопка «Проверить»). */
  async function runPipeline(): Promise<void> {
    if (!state.imageUrl) {
      runDemo();
      return;
    }
    if (!state.raw || state.analyzing) {
      return;
    }
    setBusy(true);
    try {
      const analysis: PipelineResult = await analyzeDrawing(state.raw, state.rule, state.epsilon);
      state.analysis = analysis;
      refreshCanvas();
      applyVerdict(
        analysis.verdict,
        softNotes(analysis.unboundLabels),
        formatTimings(analysis.timings),
      );
    } catch (error) {
      console.error(
        'Не удалось обработать изображение:',
        error instanceof Error ? error.stack : error,
      );
      applyVerdict(
        {
          status: 'Error',
          message: '[Status: Error] Не удалось обработать изображение',
          epsilon: state.epsilon,
        },
        [],
      );
    } finally {
      setBusy(false);
    }
  }

  function setBusy(busy: boolean): void {
    state.analyzing = busy;
    verifyButton.disabled = busy;
    verifyButton.textContent = busy ? 'Анализ…' : 'Проверить';
  }

  /** Софт-ноты: метки, не привязанные к вершинам (ТЗ §2.5 «иначе drop»). */
  function softNotes(unbound: readonly { char: string }[]): string[] {
    return unbound.map((label) => `Метка ${label.char} не привязана к вершине чертежа`);
  }

  function applyVerdict(verdict: VerifyResult, notes: readonly string[], timing?: string): void {
    state.lastVerdict = verdict;
    updateVerdictCard(verdictCard, verdict, notes, timing);
    updateStatusDot(verdict.status);
  }

  function updateStatusDot(status: VerifyResult['status']): void {
    statusDot.className =
      status === 'Success' ? 'status-dot status-dot-ok' : 'status-dot status-dot-danger';
  }

  function onRuleChange(rule: Rule): void {
    update({ rule });
  }

  function onEpsilonChange(epsilon: number): void {
    update({ epsilon });
  }

  /** Загрузка: декод с даунскейлом сразу (превью и анализ одного размера). */
  async function onFile(file: File): Promise<void> {
    const previous = state.imageUrl;
    setBusy(true);
    try {
      const decoded = await fileToRawImage(file);
      if (previous) {
        URL.revokeObjectURL(previous);
      }
      state.analysis = null;
      update({ file, imageUrl: decoded.previewUrl, raw: decoded.raw });
      setVerdictPlaceholder(verdictCard, 'Изображение загружено. Нажмите «Проверить» для анализа.');
    } catch (error) {
      // Ожидаемый путь (битое изображение): мягкая ошибка в UI, детали — в консоль.
      console.error(
        'Не удалось прочитать изображение:',
        error instanceof Error ? error.stack : error,
      );
      setVerdictPlaceholder(verdictCard, '[Status: Error] Не удалось прочитать изображение');
    } finally {
      setBusy(false);
    }
  }
}
