import { AvatarInitials } from "progra";

// No photo → initials on a 16% wash of the person's own palette color, ink
// text. Size and type size always come from className — these are the app's
// real pairs: profile hero, You header, comment, feed post, leaderboard row.
export function Sizes() {
  return (
    <div className="flex items-center gap-3">
      <AvatarInitials name="Maya Chen" username="mayac" className="size-20 text-2xl" />
      <AvatarInitials name="Maya Chen" username="mayac" className="size-[58px] text-xl" />
      <AvatarInitials name="Maya Chen" username="mayac" className="size-10 text-sm" />
      <AvatarInitials name="Maya Chen" username="mayac" className="size-[34px] text-xs" />
      <AvatarInitials name="Maya Chen" username="mayac" className="size-[30px] text-[11px]" />
    </div>
  );
}

// Each person gets a stable color from their handle.
export function People() {
  const people = [
    ["Maya Chen", "mayac"],
    ["Jordan Lee", "jlee"],
    ["Priya Raman", "priyar"],
    ["Sam", "samwrites"],
    [null, "theo.k"],
  ] as const;
  return (
    <div className="flex items-center gap-2">
      {people.map(([name, username]) => (
        <AvatarInitials key={username} name={name} username={username} className="size-9 text-xs" />
      ))}
    </div>
  );
}
