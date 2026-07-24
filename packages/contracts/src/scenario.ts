import { z } from 'zod';

export const DifficultyLevelSchema = z.enum(['beginner', 'intermediate', 'advanced']);

export const DecisionOptionSchema = z
  .object({
    id: z.string().min(1),
    label: z.string().min(1),
    consequence: z.string().min(1),
    riskLevel: z.enum(['low', 'medium', 'high', 'critical']),
  })
  .strict();

export const PhaseConsequenceSchema = z
  .object({
    correct: z.string().min(1),
    incorrect: z.string().min(1),
    feedback: z.string().min(1),
  })
  .strict();

export const PhaseScoringSchema = z
  .object({
    maxPoints: z.number().int().positive(),
    rubric: z.string().min(1),
    weight: z.number().min(0).max(1).default(1),
  })
  .strict();

export const ScenarioPhaseSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1),
    description: z.string().min(1),
    context: z.string().min(1),
    decisionPrompt: z.string().min(1),
    options: z.array(DecisionOptionSchema).min(2).max(6),
    correctOptionId: z.string().min(1),
    consequence: PhaseConsequenceSchema,
    scoring: PhaseScoringSchema,
    requiredEvidence: z.array(z.string()).optional(),
    timeoutSeconds: z.number().int().positive().optional(),
  })
  .strict();

export const ScenarioMetadataSchema = z
  .object({
    difficulty: DifficultyLevelSchema,
    estimatedMinutes: z.number().int().positive(),
    tags: z.array(z.string()).max(10).optional(),
    language: z.string().min(2).default('zh-CN'),
    version: z.string().default('1.0.0'),
  })
  .strict();

export const ScenarioSchema = z
  .object({
    id: z.string().min(1),
    sopId: z.string().min(1),
    title: z.string().min(1),
    description: z.string().min(1),
    phases: z.array(ScenarioPhaseSchema).min(1).max(20),
    metadata: ScenarioMetadataSchema,
    createdAt: z.string().datetime().optional(),
  })
  .strict();

export type DifficultyLevel = z.infer<typeof DifficultyLevelSchema>;
export type DecisionOption = z.infer<typeof DecisionOptionSchema>;
export type PhaseConsequence = z.infer<typeof PhaseConsequenceSchema>;
export type PhaseScoring = z.infer<typeof PhaseScoringSchema>;
export type ScenarioPhase = z.infer<typeof ScenarioPhaseSchema>;
export type ScenarioMetadata = z.infer<typeof ScenarioMetadataSchema>;
export type Scenario = z.infer<typeof ScenarioSchema>;
