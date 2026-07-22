import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  SopInputSchema,
  CouncilResultSchema,
  SceneSchema,
  DecisionInputSchema,
  DecisionResultSchema,
  ApiErrorSchema,
} from '@sopscape/contracts';

type FixtureFile = { path: string; valid: boolean; data: unknown };

const FIXTURES_ROOT = join(process.cwd(), 'tests', 'fixtures');

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
  // success-verify.json uses DecisionResult shape; failure-stale-version uses DecisionInput shape
  const inputFixture = loadFixtures('decision').find((f) =>
    f.path.includes('failure-stale-version'),
  );
  const resultFixture = loadFixtures('decision').find((f) => f.path.includes('success-verify'));

  it('accepts valid decision input', () => {
    if (inputFixture) {
      expect(() => DecisionInputSchema.parse(inputFixture.data)).not.toThrow();
    }
  });

  it('accepts valid decision result', () => {
    if (resultFixture) {
      expect(() => DecisionResultSchema.parse(resultFixture.data)).not.toThrow();
    }
  });
});
