import { cn } from "@/lib/utils";

// Initials from a display name (first letters of the first two words) or, when
// there's no name, the first two characters of the handle. Placeholder until
// real avatars land (deferred with photos).
function initialsOf(name: string | null, username: string): string {
  const src = (name ?? "").trim();
  if (src) {
    const parts = src.split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return src.slice(0, 2).toUpperCase();
  }
  return username.slice(0, 2).toUpperCase();
}

export function AvatarInitials({
  name,
  username,
  className,
}: {
  name: string | null;
  username: string;
  className?: string;
}) {
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
