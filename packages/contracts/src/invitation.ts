import { z } from 'zod';

export const InvitationStatusSchema = z.enum(['pending', 'accepted', 'expired']);
export type InvitationStatus = z.infer<typeof InvitationStatusSchema>;

export interface InvitationRecord {
  id: string;
  email: string;
  role: 'owner' | 'editor' | 'viewer';
  status: InvitationStatus;
  expiresAt: string;
  acceptedAt: string | null;
  createdAt: string;
}

export const MemberRecordSchema = z.object({
  id: z.string().uuid(),
  workspaceId: z.string(),
  name: z.string().min(1).max(80),
  role: z.enum(['owner', 'editor', 'viewer']),
  email: z.string().email(),
  createdAt: z.string().datetime(),
});

export type MemberRecord = z.infer<typeof MemberRecordSchema>;
