import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SopInputSchema,
  CouncilResultSchema,
  SceneSchema,
  ApiErrorSchema,
  DecisionInputSchema,
  DecisionResultSchema,
} from '@sopscape/contracts';

// ponytail: only schema-level validation fixtures belong here.
// Decision fixtures are always schema-valid; their "valid" field reflects
// domain state (VERSION_CONFLICT, etc.), which Core validates separately
// in tests/unit/state-machine.test.ts.
type FixtureFile = { path: string; valid: boolean; data: unknown };

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_ROOT = join(__dirname, '..', 'fixtures');

function loadFixtures(dir: string): FixtureFile[] {
  const fullPath = join(FIXTURES_ROOT, dir);
  return readdirSync(fullPath)
    .filter((f) => f.endsWith('.json'))
    .map((f) => {
      const raw = JSON.parse(readFileSync(join(fullPath, f), 'utf8')) as {
        valid: boolean;
        data: unknown;
      };
      return { path: `${dir}/${f}`, valid: raw.valid, data: raw.data };
    });
}

type SchemaEntry = { dir: string; parse: (d: unknown) => unknown };

const schemas: SchemaEntry[] = [
  { dir: 'sop-input', parse: (d) => SopInputSchema.parse(d) },
  { dir: 'council-result', parse: (d) => CouncilResultSchema.parse(d) },
  { dir: 'scene', parse: (d) => SceneSchema.parse(d) },
  { dir: 'api-error', parse: (d) => ApiErrorSchema.parse(d) },
];

for (const { dir, parse } of schemas) {
  describe(`fixtures: ${dir}`, () => {
    const fixtures = loadFixtures(dir);
    for (const fixture of fixtures) {
      it(`${fixture.valid ? 'accepts' : 'rejects'} ${fixture.path}`, () => {
        if (fixture.valid) {
          expect(() => parse(fixture.data)).not.toThrow();
        } else {
          expect(() => parse(fixture.data)).toThrow();
        }
      });
    }
  });
}

describe('fixtures: decision', () => {
  const fixtures = loadFixtures('decision');

  it('all decision fixtures are schema-valid (either DecisionInput or DecisionResult shape)', () => {
    for (const fixture of fixtures) {
      const tryInput = () => DecisionInputSchema.parse(fixture.data);
      const tryResult = () => DecisionResultSchema.parse(fixture.data);
      let matched = false;
      try {
        tryInput();
        matched = true;
      } catch {
        try {
          tryResult();
          matched = true;
        } catch {
          // no-op
        }
      }
      expect(
        matched,
        `Fixture ${fixture.path} matches neither DecisionInput nor DecisionResult shape`,
      ).toBe(true);
    }
  });
});
