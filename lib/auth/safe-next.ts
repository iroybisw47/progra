// Sanitize a post-auth `?next=` redirect target. Only same-origin relative
// paths are allowed — anything else (absolute URLs, protocol-relative `//host`,
// backslash tricks, userinfo `@` payloads) collapses to "/". Without this,
// `?next=https://evil.com` or `?next=//evil.com` is an open-redirect phishing
// primitive on our own trusted domain.
export function safeNextPath(next: string | null | undefined): string {
  if (!next) return "/";
  // Must start with a single "/" and not "//" or "/\" (both parse as a host).
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) {
    return "/";
  }
  // Defense in depth: reject anything with a scheme or backslash anywhere.
  if (next.includes("\\") || /^\/[a-z][a-z0-9+.-]*:/i.test(next)) {
    return "/";
  }
  return next;
}
