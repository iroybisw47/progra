import { InviteShare } from "progra";

// Friends tab's invite block (also the empty-feed CTA).
export function Default() {
  return (
    <div className="w-full px-5" style={{ maxWidth: 390 }}>
      <InviteShare />
    </div>
  );
}
