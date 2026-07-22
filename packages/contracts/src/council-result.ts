import { z } from 'zod';

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
    claim: z.string().min(1),
    evidenceRefs: z.array(z.string().min(1)),
    confidence: ConfidenceSchema,
    severity: SeveritySchema,
    affectedStepIds: z.array(z.string().min(1)),
  })
  .strict();

export const DisagreementSchema = z
  .object({
    topic: z.string().min(1),
    positions: z
      .array(
        z
          .object({
            role: AgentRoleSchema,
            stance: z.string().min(1),
          })
          .strict(),
      )
      .min(2),
  })
  .strict();

export const EvidenceGapSchema = z
  .object({
    description: z.string().min(1),
    refs: z.array(z.string().min(1)),
  })
  .strict();

export const DecisionNodeSchema = z
  .object({
    id: z.string().min(1),
    prompt: z.string().min(1),
    options: z
      .array(
        z
          .object({
            id: z.string().min(1),
            label: z.string().min(1),
            consequence: z.string().min(1),
          })
          .strict(),
      )
      .min(1),
  })
  .strict();

export const CouncilResultSchema = z
  .object({
    consensus: z.array(FindingSchema).min(1),
    disagreements: z.array(DisagreementSchema),
    evidenceGaps: z.array(EvidenceGapSchema),
    recommendedPath: z.array(z.string().min(1)),
    decisionNodes: z.array(DecisionNodeSchema),
  })
  .strict();

export type AgentRole = z.infer<typeof AgentRoleSchema>;
export type Severity = z.infer<typeof SeveritySchema>;
export type Finding = z.infer<typeof FindingSchema>;
export type Disagreement = z.infer<typeof DisagreementSchema>;
export type EvidenceGap = z.infer<typeof EvidenceGapSchema>;
export type DecisionNode = z.infer<typeof DecisionNodeSchema>;
export type CouncilResult = z.infer<typeof CouncilResultSchema>;
