/**
 * Module-scope "who is the caller" seam. The http adapter reads this to set
 * the `x-user-id` header on authenticated requests; the auth store is the
 * only writer (on sign-up/login/switch/logout).
 */
let activeUserId: string | null = null;

/** Sets the active user id (or null to clear it, e.g. on logout). */
export function setActiveUser(id: string | null): void {
  activeUserId = id;
}

/** Reads the current active user id, or null if signed out. */
export function getActiveUserId(): string | null {
  return activeUserId;
}
