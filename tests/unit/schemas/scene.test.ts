import { describe, it, expect } from 'vitest';
import { SceneSchema } from '@sopscape/contracts';

const validScene = {
  schemaVersion: '1.0.0',
  agentStates: [
    { id: 'procedure-analyst', confidence: 0.9, status: 'complete' },
    { id: 'risk-challenger', confidence: 0.85, status: 'complete' },
    { id: 'evidence-auditor', confidence: 0.8, status: 'complete' },
  ],
  evidenceNodes: [{ id: 'ev-1', ref: 'step-1', label: '发件人域名可疑' }],
  riskPaths: [{ id: 'rp-1', from: 'link-click', to: 'credential-leak', severity: 'high' }],
  decisionNodes: [{ id: 'link-click', label: '链接点击决策' }],
  cameraCues: ['agent-arrival', 'consensus-reveal'],
  paletteToken: 'neutral',
};

describe('SceneSchema', () => {
  it('accepts a valid scene', () => {
    expect(() => SceneSchema.parse(validScene)).not.toThrow();
  });

  it('accepts a scene without paletteToken (optional)', () => {
    const { paletteToken: _, ...withoutPalette } = validScene;
    expect(() => SceneSchema.parse(withoutPalette)).not.toThrow();
  });

  it('rejects unknown camera cue', () => {
    const input = { ...validScene, cameraCues: ['malicious-custom-cue'] };
    expect(() => SceneSchema.parse(input)).toThrow();
  });

  it('rejects invalid schemaVersion', () => {
    const input = { ...validScene, schemaVersion: 'v2-beta' };
    expect(() => SceneSchema.parse(input)).toThrow();
  });

  it('rejects confidence outside [0, 1] in agentStates', () => {
    const input = {
      ...validScene,
      agentStates: [{ ...validScene.agentStates[0], confidence: 2 }],
    };
    expect(() => SceneSchema.parse(input)).toThrow();
  });

  it('rejects unknown agent status', () => {
    const input = {
      ...validScene,
      agentStates: [{ ...validScene.agentStates[0], status: 'finished' }],
    };
    expect(() => SceneSchema.parse(input)).toThrow();
  });

  it('rejects unknown risk severity', () => {
    const input = {
      ...validScene,
      riskPaths: [{ ...validScene.riskPaths[0], severity: 'catastrophic' }],
    };
    expect(() => SceneSchema.parse(input)).toThrow();
  });
});
