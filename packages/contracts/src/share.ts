import { z } from 'zod';

export const CreateShareRequestSchema = z.object({
  rehearsalId: z.string(),
  expiresAt: z.string().datetime().nullable().optional(),
  maxViews: z.number().int().min(-1).optional().default(-1),
});

export const CreateShareResponseSchema = z.object({
  shareId: z.string().uuid(),
  shareToken: z.string(),
  shareUrl: z.string().url(),
  expiresAt: z.string().datetime().nullable(),
  maxViews: z.number().int().min(-1),
});

export const ShareRecordSchema = z.object({
  id: z.string().uuid(),
  token: z.string(), // 部分隐藏的 token
  expiresAt: z.string().datetime().nullable(),
  viewCount: z.number().int().min(0),
  maxViews: z.number().int().min(-1),
  createdAt: z.string().datetime(),
  createdBy: z.string().uuid(),
  rehearsalId: z.string(),
});

export const ShareListResponseSchema = z.object({
  shares: z.array(ShareRecordSchema),
});

export const SharedRehearsalSchema = z.object({
  shareId: z.string().uuid(),
  rehearsalId: z.string(),
  sopId: z.string().nullable(),
  council: z.any(), // CouncilResult
  passport: z.any(), // SopPassport
  decisions: z.array(
    z.object({
      nodeId: z.string(),
      choiceId: z.string(),
      scoreDelta: z.number(),
      riskLevel: z.string(),
      consequence: z.string(),
      coaching: z.string(),
      createdAt: z.string().datetime(),
    }),
  ),
  createdAt: z.string().datetime(),
});

export type CreateShareRequest = z.infer<typeof CreateShareRequestSchema>;
export type CreateShareResponse = z.infer<typeof CreateShareResponseSchema>;
export type ShareRecord = z.infer<typeof ShareRecordSchema>;
export type ShareListResponse = z.infer<typeof ShareListResponseSchema>;
export type SharedRehearsal = z.infer<typeof SharedRehearsalSchema>;
