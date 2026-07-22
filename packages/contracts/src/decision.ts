import { z } from 'zod';

export const DecisionInputSchema = z
  .object({
    nodeId: z.string().min(1),
    choiceId: z.string().min(1),
    expectedVersion: z.number().int().min(0),
  })
  .strict();

export const DecisionResultSchema = z
  .object({
    version: z.number().int().min(1),
    confidence: z.number().min(0).max(1),
    topology: z
      .object({
        updatedNodes: z.array(z.string().min(1)),
        removedPaths: z.array(z.string().min(1)),
      })
      .strict(),
    consequence: z
      .object({
        summary: z.string().min(1),
        nextAction: z.string().min(1),
      })
      .strict(),
  })
  .strict();

export type DecisionInput = z.infer<typeof DecisionInputSchema>;
export type DecisionResult = z.infer<typeof DecisionResultSchema>;
