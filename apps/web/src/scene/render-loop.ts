/**
 * Render loop configuration — single Three.js render loop source of truth.
 *
 * The CommandRoom component owns `renderer.setAnimationLoop`. This module
 * exports quality-profile helpers so the render loop respects the PRD budgets:
 *
 *   desktop: DPR <= 1.75, max 2 post-processing passes
 *   mobile:  DPR <= 1.25, max 1 post-processing pass
 *   reduced-motion: no camera travel, no pulsing, instant transitions
 */

export interface QualityProfile {
  dpr: number;
  reducedMotion: boolean;
  shadows: boolean;
  postProcessingPasses: number;
  particleCount: number;
}

export function getDecisionVisual(choiceId: string | null): {
  color: number;
  riskOpacity: number;
} {
  return choiceId === 'click'
    ? { color: 0xff6f83, riskOpacity: 0.9 }
    : { color: 0x60e9ff, riskOpacity: choiceId === 'verify' ? 0.18 : 0.42 };
}

/** Returns the appropriate quality profile for the current viewport. */
export function getQualityProfile(): QualityProfile {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const mobile = window.innerWidth <= 768;

  if (reducedMotion) {
    return {
      dpr: 1,
      reducedMotion: true,
      shadows: false,
      postProcessingPasses: 0,
      particleCount: 0,
    };
  }

  if (mobile) {
    return {
      dpr: Math.min(window.devicePixelRatio, 1.25),
      reducedMotion: false,
      shadows: false,
      postProcessingPasses: 1,
      particleCount: 50,
    };
  }

  return {
    dpr: Math.min(window.devicePixelRatio, 1.75),
    reducedMotion: false,
    shadows: true,
    postProcessingPasses: 2,
    particleCount: 200,
  };
}
