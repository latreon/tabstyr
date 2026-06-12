import { describe, expect, test } from 'vitest';
import { activeSeconds } from '@/lib/metrics';

describe('activeSeconds', () => {
  test('subtracts background audio from total to give foreground time', () => {
    expect(activeSeconds({ seconds: 100, audioSeconds: 30 })).toBe(70);
  });

  test('is the full total when there is no audio', () => {
    expect(activeSeconds({ seconds: 100, audioSeconds: 0 })).toBe(100);
  });

  test('clamps to 0 when audio meets or exceeds total', () => {
    expect(activeSeconds({ seconds: 30, audioSeconds: 30 })).toBe(0);
    expect(activeSeconds({ seconds: 10, audioSeconds: 25 })).toBe(0);
  });
});
