import { expect, test, describe, vi, beforeEach, afterEach } from 'vitest';
import { getDecisionVisual, getQualityProfile } from './render-loop';

describe('getQualityProfile', () => {
  beforeEach(() => {
    vi.stubGlobal('window', {
      ...window,
      innerWidth: 1920,
      devicePixelRatio: 2,
      matchMedia: vi.fn(),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('desktop profile with normal DPR', () => {
    vi.stubGlobal('window', {
      ...window,
      innerWidth: 1920,
      devicePixelRatio: 2,
      matchMedia: vi.fn().mockReturnValue({ matches: false }),
    });

    const profile = getQualityProfile();
    expect(profile.dpr).toBe(1.75); // capped
    expect(profile.shadows).toBe(true);
    expect(profile.postProcessingPasses).toBe(2);
  });

  test('mobile profile caps DPR at 1.25', () => {
    vi.stubGlobal('window', {
      ...window,
      innerWidth: 375,
      devicePixelRatio: 3,
      matchMedia: vi.fn().mockReturnValue({ matches: false }),
    });

    const profile = getQualityProfile();
    expect(profile.dpr).toBeLessThanOrEqual(1.25);
    expect(profile.shadows).toBe(false);
  });

  test('reduced-motion disables all effects', () => {
    vi.stubGlobal('window', {
      ...window,
      innerWidth: 1920,
      devicePixelRatio: 2,
      matchMedia: vi.fn().mockReturnValue({ matches: true }),
    });

    const profile = getQualityProfile();
    expect(profile.dpr).toBe(1);
    expect(profile.shadows).toBe(false);
    expect(profile.postProcessingPasses).toBe(0);
    expect(profile.particleCount).toBe(0);
  });
});

describe('getDecisionVisual', () => {
  test('maps safe and risky choices to distinct scene states', () => {
    expect(getDecisionVisual('verify')).toEqual({ color: 0x60e9ff, riskOpacity: 0.18 });
    expect(getDecisionVisual('click')).toEqual({ color: 0xff6f83, riskOpacity: 0.9 });
  });
});
