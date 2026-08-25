/**
 * Basic email-format check shared by the client invite parser and the
 * server-side member-add hardening. Deliberately strict enough to reject the
 * multi-email bug (a raw "a@x.com,b@x.com" string): no whitespace, no commas
 * or semicolons, exactly one "@", a non-empty local part, and a domain that
 * contains a dot with non-empty labels.
 */
export function isValidEmail(email: string): boolean {
  if (/[\s,;]/.test(email)) {
    return false;
  }
  const parts = email.split("@");
  if (parts.length !== 2) {
    return false;
  }
  const [local, domain] = parts as [string, string];
  if (local.length === 0) {
    return false;
  }
  return /^[^\s@]+\.[^\s@]+$/.test(domain);
}
