import type { Rule, VerifyResult } from '../pipeline/types';
import { verify } from '../pipeline/verify';
import { DEMO_DRAWINGS } from '../mock/demo-drawings';
import { createCanvasCard, renderCanvas } from './canvas-view';
import { createEpsilonSlider } from './epsilon-slider';
import { createRuleSelect } from './rule-select';
import { createUploadZone } from './upload-zone';
import { createVerdictCard, updateVerdictCard } from './verdict-card';
import type { AppState } from './types';
import { createInitialState } from './types';

/**
 * Сборка одноэкранного SPA (Фаза 1, mock): DOM строится один раз, динамика
 * обновляется по состоянию. Вердикт считается движком verify() на демо-графе,
 * поэтому переключение правила и ползунок ε реально меняют Success↔Fail.
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
  verifyButton.addEventListener('click', run);

  const controls = document.createElement('section');
  controls.className = 'card controls-card';
  const controlsHeadline = document.createElement('h2');
  controlsHeadline.className = 'headline';
  controlsHeadline.textContent = 'Параметры проверки';
  controls.append(controlsHeadline, ruleControl, epsilonControl, scenarioSelect, verifyButton);

  root.append(topbar, canvasCard, controls, verdictCard);
  refreshCanvas();
  run();

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
    run();
  }

  function refreshCanvas(): void {
    renderCanvas(canvas, state.demo, state.imageUrl);
  }

  /** Запуск «пайплайна» (Фаза 1: демо-граф + настоящий verify()). */
  function run(): void {
    const verdict = verify({ graph: state.demo.graph, rule: state.rule, epsilon: state.epsilon });
    state.lastVerdict = verdict;
    updateVerdictCard(verdictCard, verdict);
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

  function onFile(file: File): void {
    if (state.imageUrl) {
      URL.revokeObjectURL(state.imageUrl);
    }
    update({ imageUrl: URL.createObjectURL(file) });
  }
}
