import { z } from 'zod';

// ponytail: bounded array limits defined here — shared across related schemas.
const MAX_FINDINGS = 50;
const MAX_EVIDENCE_REFS = 100;
const MAX_AFFECTED_STEPS = 50;
const MAX_DISAGREEMENTS = 20;
const MAX_POSITIONS = 10;
const MAX_EVIDENCE_GAPS = 30;
const MAX_RECOMMENDED_PATH = 20;
const MAX_DECISION_NODES = 30;
const MAX_OPTIONS = 10;
const MAX_STRING = 1000;

export const AgentRoleSchema = z.enum([
  'procedure-analyst',
  'risk-challenger',
  'evidence-auditor',
  'moderator',
]);

export const SeveritySchema = z.enum(['low', 'medium', 'high', 'critical']);

const ConfidenceSchema = z.number().min(0).max(1);

export const FindingSchema = z
  .object({
    role: AgentRoleSchema,
    claim: z.string().min(1).max(MAX_STRING),
    evidenceRefs: z.array(z.string().min(1)).max(MAX_EVIDENCE_REFS),
    confidence: ConfidenceSchema,
    severity: SeveritySchema,
    affectedStepIds: z.array(z.string().min(1)).max(MAX_AFFECTED_STEPS),
    unsupported: z.boolean(),
  })
  .strict();

export const DisagreementSchema = z
  .object({
    topic: z.string().min(1).max(MAX_STRING),
    positions: z
      .array(
        z
          .object({
            role: AgentRoleSchema,
            stance: z.string().min(1).max(MAX_STRING),
          })
          .strict(),
      )
      .min(2)
      .max(MAX_POSITIONS),
  })
  .strict();

export const EvidenceGapSchema = z
  .object({
    description: z.string().min(1).max(MAX_STRING),
    refs: z.array(z.string().min(1)).max(MAX_EVIDENCE_REFS),
  })
  .strict();

export const DecisionNodeSchema = z
  .object({
    id: z.string().min(1),
    prompt: z.string().min(1).max(MAX_STRING),
    options: z
      .array(
        z
          .object({
            id: z.string().min(1),
            label: z.string().min(1).max(MAX_STRING),
            consequence: z.string().min(1).max(MAX_STRING),
          })
          .strict(),
      )
      .min(1)
      .max(MAX_OPTIONS),
  })
  .strict();

export const CouncilResultSchema = z
  .object({
    consensus: z.array(FindingSchema).min(1).max(MAX_FINDINGS),
    disagreements: z.array(DisagreementSchema).max(MAX_DISAGREEMENTS),
    evidenceGaps: z.array(EvidenceGapSchema).max(MAX_EVIDENCE_GAPS),
    recommendedPath: z.array(z.string().min(1).max(MAX_STRING)).max(MAX_RECOMMENDED_PATH),
    decisionNodes: z.array(DecisionNodeSchema).max(MAX_DECISION_NODES),
  })
  .strict();

export type AgentRole = z.infer<typeof AgentRoleSchema>;
export type Severity = z.infer<typeof SeveritySchema>;
export type Finding = z.infer<typeof FindingSchema>;
export type Disagreement = z.infer<typeof DisagreementSchema>;
export type EvidenceGap = z.infer<typeof EvidenceGapSchema>;
export type DecisionNode = z.infer<typeof DecisionNodeSchema>;
export type CouncilResult = z.infer<typeof CouncilResultSchema>;
