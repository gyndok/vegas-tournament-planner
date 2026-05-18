/**
 * Email notification utility using Resend.
 * Sends schedule change alerts to the admin.
 */

import { Resend } from 'resend'

export interface ScheduleChangeReport {
  casinoName: string
  newCount: number
  changedCount: number
  removedCount: number
}

/**
 * Send a schedule change notification email to the admin.
 * Only called when changes are detected — no-news-is-good-news.
 */
export async function sendScheduleChangeEmail(
  to: string,
  changes: ScheduleChangeReport[],
  scrapedAt: string
) {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    throw new Error('RESEND_API_KEY environment variable is not set')
  }

  const resend = new Resend(apiKey)

  const totalNew = changes.reduce((sum, c) => sum + c.newCount, 0)
  const totalChanged = changes.reduce((sum, c) => sum + c.changedCount, 0)
  const totalRemoved = changes.reduce((sum, c) => sum + c.removedCount, 0)

  const subject = `NextRebuy: ${totalNew} new, ${totalChanged} changed tournaments detected`

  const rows = changes
    .map(
      (c) =>
        `<tr>
          <td style="padding:8px 12px;border-bottom:1px solid #eee">${c.casinoName}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:center">${c.newCount || '-'}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:center">${c.changedCount || '-'}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:center">${c.removedCount || '-'}</td>
        </tr>`
    )
    .join('')

  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto">
      <h2 style="color:#1a1a1a;margin-bottom:4px">Tournament Schedule Changes Detected</h2>
      <p style="color:#666;font-size:13px;margin-top:0">Scanned at ${new Date(scrapedAt).toLocaleString('en-US', { timeZone: 'America/Los_Angeles' })} PT</p>

      <table style="border-collapse:collapse;width:100%;margin:16px 0">
        <thead>
          <tr style="background:#f5f5f5">
            <th style="padding:8px 12px;text-align:left;font-size:13px">Casino</th>
            <th style="padding:8px 12px;text-align:center;font-size:13px">New</th>
            <th style="padding:8px 12px;text-align:center;font-size:13px">Changed</th>
            <th style="padding:8px 12px;text-align:center;font-size:13px">Removed</th>
          </tr>
        </thead>
        <tbody style="font-size:13px">${rows}</tbody>
        <tfoot>
          <tr style="font-weight:bold;background:#f0f9ff">
            <td style="padding:8px 12px;font-size:13px">Total</td>
            <td style="padding:8px 12px;text-align:center;font-size:13px">${totalNew}</td>
            <td style="padding:8px 12px;text-align:center;font-size:13px">${totalChanged}</td>
            <td style="padding:8px 12px;text-align:center;font-size:13px">${totalRemoved}</td>
          </tr>
        </tfoot>
      </table>

      <p style="margin-top:16px;font-size:13px">
        <a href="https://nextrebuy.com/admin" style="color:#3b82f6;text-decoration:none">
          Open Admin Panel →
        </a>
      </p>

      <p style="margin-top:24px;color:#999;font-size:11px">
        This is an automated notification from NextRebuy schedule monitoring.
      </p>
    </div>
  `

  await resend.emails.send({
    from: 'NextRebuy <notifications@nextrebuy.com>',
    to,
    subject,
    html,
  })
}

export async function sendPoolCancelledEmail(opts: {
  toEmails: string[]
  poolName: string
  reason: 'tournament_cancelled' | 'organizer_cancel'
}) {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey || opts.toEmails.length === 0) return
  const resend = new Resend(apiKey)
  const reasonText = opts.reason === 'tournament_cancelled'
    ? 'The underlying tournament was cancelled.'
    : 'The pool organizer cancelled the pool.'
  await resend.emails.send({
    from: 'NextRebuy <noreply@nextrebuy.com>',
    to: opts.toEmails,
    subject: `Last Longer Pool cancelled — ${opts.poolName}`,
    html: `
      <p>The pool <strong>${escapeHtml(opts.poolName)}</strong> has been cancelled.</p>
      <p>${reasonText}</p>
      <p>If you have any out-of-band balance with the organizer, please settle directly.</p>
    `,
  })
}

export async function sendPoolWinnerEmail(opts: {
  toEmails: string[]
  poolName: string
  winnerDisplayName: string
}) {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey || opts.toEmails.length === 0) return
  const resend = new Resend(apiKey)
  await resend.emails.send({
    from: 'NextRebuy <noreply@nextrebuy.com>',
    to: opts.toEmails,
    subject: `Last Longer Pool winner — ${opts.poolName}`,
    html: `
      <p>The pool <strong>${escapeHtml(opts.poolName)}</strong> has ended.</p>
      <p>Winner: <strong>${escapeHtml(opts.winnerDisplayName)}</strong></p>
      <p>Settle any out-of-band stakes directly with the pool organizer.</p>
    `,
  })
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string
  ))
}
