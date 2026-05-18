import { randomBytes } from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { PoolAuditAction, PoolMember, PoolStatus } from '@/types'

/**
 * Cryptographically random invite token, 256 bits, base64url-encoded.
 * Length: 43 chars.
 */
export function generateInviteToken(): string {
  return randomBytes(32).toString('base64url')
}

/**
 * Resolve a member's display name using the fallback chain:
 *   1. pool_members.display_name (per-pool override)
 *   2. auth user metadata: full_name
 *   3. auth user metadata: name
 *   4. Email local-part (everything before '@')
 *   5. "Former player" (user was deleted)
 *
 * `user` is the joined row from auth.users — but auth.users is not exposed
 * to anon Postgres clients, so the caller must fetch via service role.
 */
export interface AuthUserShape {
  email?: string | null
  raw_user_meta_data?: Record<string, unknown> | null
}

export function resolveDisplayName(member: Pick<PoolMember, 'display_name' | 'user_id'>, user?: AuthUserShape | null): string {
  if (member.display_name) return member.display_name
  if (user?.raw_user_meta_data) {
    const meta = user.raw_user_meta_data
    if (typeof meta.full_name === 'string' && meta.full_name.trim()) return meta.full_name
    if (typeof meta.name === 'string' && meta.name.trim()) return meta.name
  }
  if (user?.email) return user.email.split('@')[0]
  return 'Former player'
}

/**
 * Write a single audit log entry. Must be called with a service-role client
 * because the pool_audit_log RLS denies all client inserts.
 */
export async function writeAuditLog(
  svc: SupabaseClient,
  args: {
    pool_id: string
    member_id?: string | null
    actor_id: string | null
    action: PoolAuditAction
    metadata?: Record<string, unknown>
  }
): Promise<void> {
  const { error } = await svc.from('pool_audit_log').insert({
    pool_id: args.pool_id,
    member_id: args.member_id ?? null,
    actor_id: args.actor_id,
    action: args.action,
    metadata: args.metadata ?? {},
  })
  if (error) {
    // Never block the main operation on audit logging — log to stderr.
    console.error('[pool-audit] insert failed', error.message, { ...args, metadata: undefined })
  }
}

/**
 * Compute bust_order for an array of members. 1 = first out, ascending busted_at.
 * Alive and no_show members get null. Mutates and returns the same array (sorted
 * with alive first, then busted by order, then no_show).
 */
export function annotateBustOrder(members: PoolMember[]): PoolMember[] {
  const busted = members
    .filter(m => m.status === 'busted' && m.busted_at)
    .sort((a, b) => (a.busted_at! < b.busted_at! ? -1 : 1))
  busted.forEach((m, i) => { m.bust_order = i + 1 })

  return members.map(m => {
    if (m.status !== 'busted') m.bust_order = null
    return m
  })
}

const ALLOWED_TRANSITIONS: Record<PoolStatus, PoolStatus[]> = {
  draft:     ['open', 'cancelled'],
  open:      ['locked', 'cancelled'],
  locked:    ['live', 'cancelled'],
  live:      ['ended', 'cancelled'],
  ended:     [],
  cancelled: [],
}

export function canTransition(from: PoolStatus, to: PoolStatus): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false
}
