import { z } from 'zod';

export const ApiErrorSchema = z
  .object({
    code: z.string().min(1).max(100),
    message: z.string().min(1).max(500),
    retryable: z.boolean(),
    requestId: z.string().min(1).max(128),
  })
  .strict();

export type ApiError = z.infer<typeof ApiErrorSchema>;
