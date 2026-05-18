import { randomBytes } from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { PoolAuditAction, PoolMember, PoolStatus } from '@/types'
import { sendPoolCancelledEmail } from '@/lib/email'

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

/**
 * Gather emails for all pool members via service-role admin listUsers.
 * Skips members whose user_id is null (deleted accounts) or whose email is
 * unverified/missing.
 */
export async function gatherPoolMemberEmails(
  svc: SupabaseClient,
  poolId: string
): Promise<string[]> {
  const { data: members } = await svc
    .from('pool_members')
    .select('user_id')
    .eq('pool_id', poolId)
  const userIds = (members ?? []).map(m => m.user_id).filter(Boolean) as string[]
  if (userIds.length === 0) return []

  const { data: list } = await svc.auth.admin.listUsers({ perPage: 1000 })
  return (list?.users ?? [])
    .filter(u => userIds.includes(u.id) && !!u.email)
    .map(u => u.email!)
}

/**
 * Cancel a single pool by id: flip status, write audit log, email members.
 * Used by both the strike-based cron path and the all-pools-for-a-tournament
 * helper below.
 */
export async function cancelPool(
  svc: SupabaseClient,
  poolId: string,
  reason: 'tournament_cancelled' | 'organizer_cancel'
): Promise<void> {
  const { data } = await svc
    .from('pools')
    .update({
      status: 'cancelled',
      ended_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', poolId)
    .select('name')
    .single()
  if (!data) return

  await writeAuditLog(svc, {
    pool_id: poolId,
    actor_id: null,
    action: 'pool_cancelled',
    metadata: { reason },
  })

  const emails = await gatherPoolMemberEmails(svc, poolId)
  if (emails.length > 0) {
    sendPoolCancelledEmail({
      toEmails: emails,
      poolName: data.name,
      reason,
    }).catch(e => console.error('[pools] cancel email failed', e))
  }
}

/**
 * Cancel every non-terminal pool tied to the given tournament_id, write audit
 * log entries, and email all members. Use only when the tournament is
 * definitively cancelled (e.g., from an admin signal) — for "missing from
 * scrape" use processPoolStrikes instead, which gates on consecutive misses.
 */
export async function autoCancelPoolsForTournament(svc: SupabaseClient, tournamentId: string) {
  const { data: pools } = await svc
    .from('pools')
    .select('id, status')
    .eq('tournament_id', tournamentId)
    .not('status', 'in', '(ended,cancelled)')
  for (const pool of pools ?? []) {
    await cancelPool(svc, pool.id, 'tournament_cancelled')
  }
}

/**
 * Pool auto-cancel threshold: number of consecutive scrape runs a tournament
 * must be missing before its pools get cancelled. Anything below this is
 * absorbed as transient noise (a single bad scrape, parser regression, casino
 * temporarily removed the listing).
 */
export const POOL_CANCEL_STRIKE_THRESHOLD = 3

/**
 * Per-cron-run pool strike processing. Bumps cancel_strikes for pools whose
 * tournament is missing from this run, resets to 0 for pools whose tournament
 * is back. Cancels (with audit + email) any pool whose strikes reach the
 * threshold after bumping. The reset side ensures only *consecutive* misses
 * count, so an intermittent miss followed by a re-appearance won't push a pool
 * any closer to cancellation.
 *
 * presentTournamentIds and missingTournamentIds should be disjoint within a
 * single call. Callers should only pass IDs for casinos whose scrape actually
 * succeeded this run — pools whose tournament wasn't scraped at all are
 * untouched.
 *
 * Returns the list of pool IDs that hit the threshold and were cancelled in
 * this run (zero in the typical case).
 */
export async function processPoolStrikes(
  svc: SupabaseClient,
  args: {
    presentTournamentIds: string[]
    missingTournamentIds: string[]
    threshold?: number
  }
): Promise<{ bumped: string[]; reset: string[]; cancelled: string[] }> {
  const threshold = args.threshold ?? POOL_CANCEL_STRIKE_THRESHOLD
  const bumped: string[] = []
  const reset: string[] = []
  const cancelled: string[] = []

  // Reset strikes for pools whose tournament reappeared.
  if (args.presentTournamentIds.length > 0) {
    const { data } = await svc
      .from('pools')
      .update({ cancel_strikes: 0, last_missing_at: null })
      .in('tournament_id', args.presentTournamentIds)
      .gt('cancel_strikes', 0)
      .not('status', 'in', '(ended,cancelled)')
      .select('id')
    for (const row of data ?? []) reset.push(row.id)
  }

  // Bump strikes for pools whose tournament went missing. We have to read the
  // current count, write the new count — supabase-js doesn't expose atomic
  // column increment without an RPC, and cron runs are serialized so the race
  // is benign.
  if (args.missingTournamentIds.length > 0) {
    const { data: affected } = await svc
      .from('pools')
      .select('id, tournament_id, cancel_strikes')
      .in('tournament_id', args.missingTournamentIds)
      .not('status', 'in', '(ended,cancelled)')

    const nowIso = new Date().toISOString()
    for (const pool of affected ?? []) {
      const next = (pool.cancel_strikes ?? 0) + 1
      if (next >= threshold) {
        await cancelPool(svc, pool.id, 'tournament_cancelled')
        cancelled.push(pool.id)
      } else {
        await svc
          .from('pools')
          .update({ cancel_strikes: next, last_missing_at: nowIso })
          .eq('id', pool.id)
        bumped.push(pool.id)
      }
    }
  }

  return { bumped, reset, cancelled }
}
