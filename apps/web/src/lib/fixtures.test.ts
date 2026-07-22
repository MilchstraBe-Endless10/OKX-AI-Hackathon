import { describe, expect, test } from 'vitest';
import { COUNCIL_FIXTURE, SCENE_FIXTURE } from './fixtures';

describe('merged contract fixtures', () => {
  test('loads the council result through the shared runtime schema', () => {
    expect(COUNCIL_FIXTURE.consensus[0]?.role).toBe('procedure-analyst');
    expect(COUNCIL_FIXTURE.decisionNodes[0]?.options).toHaveLength(2);
    expect(COUNCIL_FIXTURE.disagreements).not.toHaveLength(0);
    expect(COUNCIL_FIXTURE.evidenceGaps).not.toHaveLength(0);
  });

  test('loads the command-room scene through the shared runtime schema', () => {
    expect(SCENE_FIXTURE.schemaVersion).toBe('1.0.0');
    expect(SCENE_FIXTURE.agentStates).toHaveLength(3);
  });
});
