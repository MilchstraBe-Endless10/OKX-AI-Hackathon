import { CouncilResultSchema, SceneSchema } from '@sopscape/contracts';
import councilFixture from '../../../../tests/fixtures/council-result/success-consensus.json';
import disagreementFixture from '../../../../tests/fixtures/council-result/success-disagreement.json';
import sceneFixture from '../../../../tests/fixtures/scene/success-hologram.json';

/**
 * The shell intentionally consumes A's checked-in fixtures through the shared
 * runtime schemas. Invalid fixture changes therefore fail during module load
 * instead of silently drifting into a second frontend contract.
 */
export const COUNCIL_FIXTURE = CouncilResultSchema.parse({
  ...councilFixture.data,
  disagreements: disagreementFixture.data.disagreements,
  evidenceGaps: disagreementFixture.data.evidenceGaps,
});
export const SCENE_FIXTURE = SceneSchema.parse(sceneFixture.data);
