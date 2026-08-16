import { tint, userColor } from "@/lib/colors";
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
  // No photo: initials on a wash of the person's own palette color, so people
  // are as recognizable by color as goals and categories are.
  const color = userColor(username ?? "");
  return (
    <span
      aria-hidden
      className={cn(
        "flex items-center justify-center rounded-full font-semibold",
        className
      )}
      style={{ backgroundColor: tint(color, 0.16), color }}
    >
      {initialsOf(name, username)}
    </span>
  );
}
