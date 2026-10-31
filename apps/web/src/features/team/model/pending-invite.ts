export const PENDING_INVITE_KEY = 'vextra.pending-invite'

/** Where to go after a login when an invitation link was opened first. */
export function readPendingInvite(): string | null {
  try {
    return window.sessionStorage.getItem(PENDING_INVITE_KEY)
  } catch {
    return null
  }
}
