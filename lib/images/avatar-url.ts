// Public URL for a blob in the public `avatars` bucket. Pure string build —
// no network round-trip — and NEXT_PUBLIC_ env means it works on both server
// and client. Cache-busting comes from the path itself: every upload writes a
// fresh `avatar-<uuid>.jpg` filename, so URLs are immutable and browsers can
// cache them indefinitely.
export function avatarPublicUrl(path: string | null): string | null {
  if (!path) return null;
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/${path}`;
}
