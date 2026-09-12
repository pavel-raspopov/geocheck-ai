import type { VerifyStatus } from '../pipeline/types';

/** Русские подписи бейджа (строки ТЗ — контракт: Success «Верно», Fail/Error «Ошибка»). */
const BADGE_LABELS: Record<VerifyStatus, string> = {
  Success: 'Верно',
  Fail: 'Ошибка',
  Error: 'Ошибка',
};

/** Бейдж статуса вердикта: зелёный для Success, красный для Fail/Error. */
export function createVerdictBadge(status: VerifyStatus): HTMLElement {
  const badge = document.createElement('span');
  badge.className = `badge badge-${status === 'Success' ? 'ok' : 'danger'}`;
  badge.textContent = BADGE_LABELS[status];
  return badge;
}
