import { cn } from "@/lib/utils";

// Initials from a display name (first letters of the first two words) or, when
// there's no name, the first two characters of the handle. Shown whenever the
// user has no uploaded avatar.
function initialsOf(name: string | null, username: string): string {
  const src = (name ?? "").trim();
  if (src) {
    const parts = src.split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return src.slice(0, 2).toUpperCase();
  }
  // Defensive: a handle-less profile should never reach here (queries filter
  // them), but a "?" beats crashing the whole page if one slips through.
  return ((username ?? "").slice(0, 2) || "?").toUpperCase();
}

// The app-wide avatar: uploaded photo when present (public-bucket URL —
// immutable per upload, so browsers cache it), initials otherwise. Size and
// text size come entirely from the caller's className, same as always.
export function AvatarInitials({
  name,
  username,
  avatarUrl = null,
  className,
}: {
  name: string | null;
  username: string;
  avatarUrl?: string | null;
  className?: string;
}) {
  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt=""
        aria-hidden
        loading="lazy"
        decoding="async"
        className={cn("shrink-0 rounded-full object-cover", className)}
      />
    );
  }
  return (
    <span
      aria-hidden
      className={cn(
        "bg-brand flex items-center justify-center rounded-full font-semibold text-[#fcf6ef]",
        className
      )}
    >
      {initialsOf(name, username)}
    </span>
  );
}
