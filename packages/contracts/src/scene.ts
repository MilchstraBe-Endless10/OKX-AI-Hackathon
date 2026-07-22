import { z } from 'zod';
import { SeveritySchema } from './council-result.js';

// ponytail: whitelist of camera cue IDs — model output must only reference known cues,
// never arbitrary strings that could drive unauthorized renderer behavior.
export const CameraCueSchema = z.enum([
  'agent-arrival',
  'consensus-reveal',
  'disagreement-highlight',
  'evidence-node-show',
  'risk-path-trace',
  'decision-focus',
  'consequence-pan',
  'palette-shift',
  'idle',
]);

export const PaletteTokenSchema = z.enum(['neutral', 'safe', 'caution', 'danger']);

export const AgentStateSchema = z
  .object({
    id: z.string().min(1),
    confidence: z.number().min(0).max(1),
    status: z.enum(['idle', 'running', 'complete', 'failed']),
  })
  .strict();

export const EvidenceNodeSchema = z
  .object({
    id: z.string().min(1),
    ref: z.string().min(1),
    label: z.string().min(1),
  })
  .strict();

export const RiskPathSchema = z
  .object({
    id: z.string().min(1),
    from: z.string().min(1),
    to: z.string().min(1),
    severity: SeveritySchema,
  })
  .strict();

export const SceneDecisionNodeSchema = z
  .object({
    id: z.string().min(1),
    label: z.string().min(1),
  })
  .strict();

export const SceneSchema = z
  .object({
    schemaVersion: z.string().regex(/^\d+\.\d+\.\d+$/, 'schemaVersion must be semver x.y.z'),
    agentStates: z.array(AgentStateSchema),
    evidenceNodes: z.array(EvidenceNodeSchema),
    riskPaths: z.array(RiskPathSchema),
    decisionNodes: z.array(SceneDecisionNodeSchema),
    cameraCues: z.array(CameraCueSchema),
    paletteToken: PaletteTokenSchema.optional(),
  })
  .strict();

export type CameraCue = z.infer<typeof CameraCueSchema>;
export type PaletteToken = z.infer<typeof PaletteTokenSchema>;
export type AgentState = z.infer<typeof AgentStateSchema>;
export type EvidenceNode = z.infer<typeof EvidenceNodeSchema>;
export type RiskPath = z.infer<typeof RiskPathSchema>;
export type SceneDecisionNode = z.infer<typeof SceneDecisionNodeSchema>;
export type Scene = z.infer<typeof SceneSchema>;
