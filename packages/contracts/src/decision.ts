import { z } from 'zod';

const MAX_NODE_IDS = 50;
const MAX_PATH_IDS = 50;

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
        updatedNodes: z.array(z.string().min(1)).max(MAX_NODE_IDS),
        removedPaths: z.array(z.string().min(1)).max(MAX_PATH_IDS),
      })
      .strict(),
    consequence: z
      .object({
        summary: z.string().min(1).max(1000),
        nextAction: z.string().min(1).max(1000),
      })
      .strict(),
  })
  .strict();

export type DecisionInput = z.infer<typeof DecisionInputSchema>;
export type DecisionResult = z.infer<typeof DecisionResultSchema>;
