import { describe, expect, it } from 'vitest';
import { formatTimings } from './types';

describe('formatTimings', () => {
  it('стадии и total в секундах, 2 знака', () => {
    expect(
      formatTimings({ detect: 340.4, recognize: 1210.9, graph: 0.2, verify: 0.1, total: 1551.6 }),
    ).toBe('CV 0.34 с · OCR 1.21 с · всего 1.55 с');
  });
});
