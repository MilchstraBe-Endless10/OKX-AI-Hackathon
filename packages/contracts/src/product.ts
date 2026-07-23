import { z } from 'zod';
import { CouncilResultSchema } from './council-result.js';

export const ReadinessVerdictSchema = z.enum(['BLOCK', 'WARN', 'READY']);
export const RiskLevelSchema = z.enum(['low', 'medium', 'high', 'critical']);

export const SopPassportSchema = z
  .object({
    id: z.string().min(1),
    sopId: z.string().min(1),
    version: z.number().int().positive(),
    verdict: ReadinessVerdictSchema,
    score: z.number().int().min(0).max(100),
    evidenceCoverage: z.number().min(0).max(1),
    blockers: z.array(z.string()),
    warnings: z.array(z.string()),
    evidenceRefs: z.array(z.string()),
    generatedAt: z.string().datetime(),
  })
  .strict();

export const SopVersionSchema = z
  .object({
    id: z.string().min(1),
    sopId: z.string().min(1),
    version: z.number().int().positive(),
    content: z.string().min(1),
    council: CouncilResultSchema,
    passport: SopPassportSchema,
    createdAt: z.string().datetime(),
  })
  .strict();

export const SopRecordSchema = z
  .object({
    id: z.string().min(1),
    workspaceId: z.string().min(1),
    title: z.string().min(1),
    locale: z.string().min(2),
    owner: z.string().min(1),
    status: ReadinessVerdictSchema,
    latestVersion: z.number().int().positive(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    passport: SopPassportSchema,
  })
  .strict();

export const DecisionEvaluationSchema = z
  .object({
    nodeId: z.string().min(1),
    choiceId: z.string().min(1),
    scoreDelta: z.number().int().min(-100).max(100),
    riskLevel: RiskLevelSchema,
    consequence: z.string().min(1),
    coaching: z.string().min(1),
  })
  .strict();

export const VersionComparisonSchema = z
  .object({
    fromVersion: z.number().int().positive().optional(),
    toVersion: z.number().int().positive().optional(),
    changedLines: z.number().int().nonnegative(),
    addedLines: z.array(z.string()),
    removedLines: z.array(z.string()),
    riskDelta: z.number().int().min(-100).max(100),
    regressed: z.boolean(),
    summary: z.string().min(1),
  })
  .strict();

export type ReadinessVerdict = z.infer<typeof ReadinessVerdictSchema>;
export type RiskLevel = z.infer<typeof RiskLevelSchema>;
export type SopPassport = z.infer<typeof SopPassportSchema>;
export type SopVersion = z.infer<typeof SopVersionSchema>;
export type SopRecord = z.infer<typeof SopRecordSchema>;
export type DecisionEvaluation = z.infer<typeof DecisionEvaluationSchema>;
export type VersionComparison = z.infer<typeof VersionComparisonSchema>;
