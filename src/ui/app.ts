import { parseTask } from '../pipeline/rules/parse';
import { extractRulesGemini } from '../pipeline/rules/gemini';
import { evaluateRules, type RulesEvaluation } from '../pipeline/rules/rules-engine';
import { analyzeImage, type AnalyzeResult } from '../pipeline/run';
import { DEMO_DRAWINGS } from '../mock/demo-drawings';
import { createCanvasCard, renderCanvas, type CanvasOverlay } from './canvas-view';
import { createChecklistCard, setChecklistPlaceholder, updateChecklist } from './verdict-checklist';
import { createEpsilonSlider } from './epsilon-slider';
import { createGeminiFallback } from './gemini-fallback';
import { fileToRawImage } from './image-input';
import { createRulesPreview } from './rules-preview';
import { createTaskText } from './task-text';
import { createUploadZone } from './upload-zone';
import { formatTimings } from './types';
import type { AppState } from './types';
import { createInitialState } from './types';

/**
 * Сборка одноэкранного SPA v2 (фича 11): текст задачи → парсер → предпросмотр
 * правил → подтверждение (human-in-the-loop) → мульт-проверка evaluateRules.
 * С изображением — полный анализ (CV/OCR один раз, дальше пересчёт по графу);
 * без изображения — мгновенная проверка на графе демо-сцены.
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
  const checklistCard = createChecklistCard();

  const taskControl = createTaskText(state.taskText, onTaskText);
  const preview = createRulesPreview(onConfirm);
  const fallback = createGeminiFallback(onGeminiExtract);
  const epsilonControl = createEpsilonSlider(state.epsilon, onEpsilonChange);
  const scenarioSelect = createScenarioSelect();

  const controls = document.createElement('section');
  controls.className = 'card controls-card';
  const controlsHeadline = document.createElement('h2');
  controlsHeadline.className = 'headline';
  controlsHeadline.textContent = 'Параметры проверки';
  controls.append(
    controlsHeadline,
    taskControl,
    preview.root,
    fallback.root,
    epsilonControl,
    scenarioSelect,
  );

  root.append(topbar, canvasCard, controls, checklistCard);
  refreshCanvas();
  onTaskText(state.taskText); // стартовый разбор демо-текста → предпросмотр готов к подтверждению

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
        state.demo = demo;
        refreshCanvas();
        if (!state.imageUrl && state.confirmed) runDemoEvaluation();
      }
    });
    label.append(caption, select);
    return label;
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

  /* --- Разбор текста и подтверждение правил (human-in-the-loop) --- */

  function onTaskText(text: string): void {
    state.taskText = text;
    state.parsed = parseTask(text);
    state.confirmed = null; // правка текста сбрасывает подтверждение
    state.lastEvaluation = null;
    renderPreview();
    setChecklistPlaceholder(
      checklistCard,
      'Подтвердите правила и нажмите «Подтвердить и проверить».',
    );
    updateStatusDot(null);
  }

  function renderPreview(): void {
    if (state.parsed?.ok) {
      preview.render(state.parsed.task, null);
      fallback.setOpen(false);
      fallback.setError(null);
    } else {
      preview.render(null, state.parsed?.error ?? null);
      fallback.setOpen(state.parsed !== null); // не распарсилось → раскрыть фолбэк
    }
  }

  function onConfirm(): void {
    if (!state.parsed?.ok || state.analyzing || state.extracting) return;
    state.confirmed = state.parsed.task;
    if (state.imageUrl && state.raw) void runPipeline();
    else runDemoEvaluation();
  }

  /* --- Проверка --- */

  /** Демо-режим: мгновенный evaluateRules на графе демо-сцены (без CV/OCR). */
  function runDemoEvaluation(): void {
    if (!state.confirmed) return;
    applyEvaluation(evaluateRules(state.demo.graph, state.confirmed.relations, state.epsilon), []);
  }

  /** Полный анализ загруженного изображения + мульт-проверка подтверждённых правил. */
  async function runPipeline(): Promise<void> {
    if (!state.raw || state.analyzing || !state.confirmed) return;
    if (state.analysis) {
      // Граф уже построен (изображение не менялось) — пересчёт без повторного CV/OCR.
      applyEvaluation(
        evaluateRules(state.analysis.graph, state.confirmed.relations, state.epsilon),
        softNotes(state.analysis.unboundLabels),
        formatTimings(state.analysis.timings),
      );
      return;
    }
    setBusy(true);
    setChecklistPlaceholder(checklistCard, 'Анализ чертежа…');
    try {
      const analysis: AnalyzeResult = await analyzeImage(state.raw);
      if (analysis.segments.length === 0) {
        setChecklistPlaceholder(checklistCard, '[Status: Error] На чертеже не найдено отрезков');
        updateStatusDot('Error');
        return;
      }
      state.analysis = analysis;
      refreshCanvas();
      applyEvaluation(
        evaluateRules(analysis.graph, state.confirmed.relations, state.epsilon),
        softNotes(analysis.unboundLabels),
        formatTimings(analysis.timings),
      );
    } catch (error) {
      console.error(
        'Не удалось обработать изображение:',
        error instanceof Error ? error.stack : error,
      );
      setChecklistPlaceholder(checklistCard, '[Status: Error] Не удалось обработать изображение');
      updateStatusDot('Error');
    } finally {
      setBusy(false);
    }
  }

  function setBusy(busy: boolean): void {
    state.analyzing = busy;
    const confirm = preview.root.querySelector<HTMLButtonElement>('#confirm-rules');
    if (confirm) confirm.disabled = busy;
  }

  /** Софт-ноты: метки, не привязанные к вершинам (ТЗ §2.5 «иначе drop»). */
  function softNotes(unbound: readonly { char: string }[]): string[] {
    return unbound.map((label) => `Метка ${label.char} не привязана к вершине чертежа`);
  }

  function applyEvaluation(
    evaluation: RulesEvaluation,
    notes: readonly string[],
    timing?: string,
  ): void {
    state.lastEvaluation = evaluation;
    updateChecklist(checklistCard, evaluation, notes, timing);
    updateStatusDot(evaluation.verdict);
  }

  function updateStatusDot(status: RulesEvaluation['verdict'] | null): void {
    statusDot.className =
      status === 'Success' ? 'status-dot status-dot-ok' : 'status-dot status-dot-danger';
  }

  function onEpsilonChange(epsilon: number): void {
    state.epsilon = epsilon;
    // Пересчёт на сохранённом графе (OCR/OpenCV заново не запускаются).
    if (!state.confirmed) return;
    if (state.analysis) {
      applyEvaluation(
        evaluateRules(state.analysis.graph, state.confirmed.relations, epsilon),
        softNotes(state.analysis.unboundLabels),
        formatTimings(state.analysis.timings),
      );
    } else if (!state.imageUrl) {
      runDemoEvaluation();
    }
  }

  /* --- Фолбэк Gemini (только по явному действию пользователя) --- */

  async function onGeminiExtract(apiKey: string): Promise<void> {
    if (state.extracting) return;
    state.extracting = true;
    fallback.setBusy(true);
    fallback.setError(null);
    try {
      const result = await extractRulesGemini(state.taskText, apiKey);
      if (result.ok) {
        state.parsed = result;
        state.confirmed = null;
        state.lastEvaluation = null;
        fallback.setOpen(false);
        preview.render(result.task, null);
        setChecklistPlaceholder(
          checklistCard,
          'Подтвердите правила и нажмите «Подтвердить и проверить».',
        );
        updateStatusDot(null);
      } else {
        fallback.setError(result.error);
      }
    } finally {
      state.extracting = false;
      fallback.setBusy(false);
    }
  }

  /** Загрузка: декод с даунскейлом сразу (превью и анализ одного размера). */
  async function onFile(file: File): Promise<void> {
    const previous = state.imageUrl;
    try {
      const decoded = await fileToRawImage(file);
      if (previous) {
        URL.revokeObjectURL(previous);
      }
      state.analysis = null;
      state.lastEvaluation = null;
      state.imageUrl = decoded.previewUrl;
      state.file = file;
      state.raw = decoded.raw;
      refreshCanvas();
      setChecklistPlaceholder(
        checklistCard,
        'Изображение загружено. Подтвердите правила — чертёж будет проанализирован.',
      );
      updateStatusDot(null);
    } catch (error) {
      // Ожидаемый путь (битое изображение): мягкая ошибка в UI, детали — в консоль.
      console.error(
        'Не удалось прочитать изображение:',
        error instanceof Error ? error.stack : error,
      );
      setChecklistPlaceholder(checklistCard, '[Status: Error] Не удалось прочитать изображение');
    }
  }
}
