import { z } from 'zod';

const MAX_CONTENT_BYTES = 60_000;

const utf8ByteLength = (str: string): number => new TextEncoder().encode(str).length;

export const ScenarioMetadataSchema = z
  .object({
    domain: z.string().min(1).max(100),
    urgency: z.enum(['low', 'medium', 'high']),
  })
  .strict();

export const SopInputSchema = z
  .object({
    title: z.string().min(1).max(200),
    content: z.string().superRefine((val, ctx) => {
      const bytes = utf8ByteLength(val);
      if (bytes === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'content must not be empty',
          path: ['content'],
        });
      }
      if (bytes > MAX_CONTENT_BYTES) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `content exceeds ${MAX_CONTENT_BYTES} UTF-8 bytes (got ${bytes})`,
          path: ['content'],
        });
      }
    }),
    locale: z.enum(['zh-CN', 'en-US']).optional(),
    scenarioMetadata: ScenarioMetadataSchema.optional(),
  })
  .strict();

export type SopInput = z.infer<typeof SopInputSchema>;
export type ScenarioMetadata = z.infer<typeof ScenarioMetadataSchema>;
