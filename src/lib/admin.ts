/**
 * Check if an email is in the ADMIN_EMAILS list.
 * Returns true if ADMIN_EMAILS is not set (dev mode open access).
 */
export function isAdminEmail(email: string | null | undefined): boolean {
  const adminEmails = process.env.ADMIN_EMAILS
  // Open access during development if ADMIN_EMAILS is not set
  if (!adminEmails) return true
  if (!email) return false
  const allowed = adminEmails.split(',').map((e) => e.trim().toLowerCase())
  return allowed.includes(email.toLowerCase())
}
