import type { ReactNode } from "react";

// The Today / Week / History switcher's pill, shared by the Progress tab and
// /history so the rail doesn't shift or restyle when you cross between them.
// Progress renders its two sub-tabs as <button>s (client state) and History as a
// <Link>; /history renders all three as <Link>s. Different elements, one look —
// which is exactly what these constants exist to guarantee.
export const CHIP =
  "rounded-full px-[13px] py-[5px] text-[11px] font-semibold uppercase tracking-[0.06em] transition-colors";
export const CHIP_ON = "bg-brand text-primary-foreground";
export const CHIP_OFF = "text-faint";

// The track the chips sit in.
export function ChipRail({ children }: { children: ReactNode }) {
  return (
    <div className="bg-track flex gap-0.5 rounded-full p-[3px]">{children}</div>
  );
}
