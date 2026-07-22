import { expect, test, describe, vi, beforeEach, afterEach } from 'vitest';
import { getDecisionVisual, getNextOrbit, getQualityProfile } from './render-loop';

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

describe('getNextOrbit', () => {
  test('allows full horizontal rotation and clamps vertical rotation', () => {
    expect(getNextOrbit({ yaw: 0, pitch: 0.1 }, 400, -200)).toEqual({
      yaw: -2,
      pitch: 0.85,
    });
    expect(getNextOrbit({ yaw: Math.PI * 2, pitch: 0 }, -200, 200)).toEqual({
      yaw: Math.PI * 2 + 1,
      pitch: -0.3,
    });
  });
});
