import { Donut } from "@/components/v2/donut";
import { formatDuration } from "@/lib/duration";
import { cn } from "@/lib/utils";
import { postWheel, type PostSlice } from "@/lib/weekly-review";

// A posted weekly review's wheel: where the week went, as a ring with the
// slices listed beside it, under the review's numbers. The same on the Share
// slide's preview, the feed card and /review/[id], like ReviewStats, so what's
// posted is what was previewed. What the slices are is postSlices' call
// (lib/weekly-review.ts); postWheel reads old posts too. Renders nothing for a
// week with no time.
//
// On the feed card ("md") the list stops at four rows and counts the rest;
// the post's own page ("lg") lists every stored slice.
const MD_ROWS = 4;

export function ReviewWheel({
  slices,
  size = "md",
  className,
}: {
  slices: readonly PostSlice[] | null | undefined;
  size?: "md" | "lg";
  className?: string;
}) {
  const wheel = postWheel(slices);
  if (!wheel) return null;
  const lg = size === "lg";
  const shown = lg ? wheel.rows : wheel.rows.slice(0, MD_ROWS);
  const more = wheel.rows.length - shown.length;
  return (
    <div
      className={cn(
        "flex items-center border-t border-[rgba(28,58,94,.08)]",
        lg ? "gap-5 pt-5" : "gap-4 pt-4",
        className
      )}
    >
      <div aria-hidden>
        <Donut segments={wheel.segments} size={lg ? 112 : 84} stroke={lg ? 15 : 12} />
      </div>
      <ul className="flex min-w-0 flex-1 flex-col gap-1.5" aria-label="Where the week went">
        {shown.map((r, i) => (
          <li key={`${r.name}:${i}`} className="flex items-center gap-2">
            <span aria-hidden className="size-2 shrink-0 rounded-[2px]" style={{ backgroundColor: r.color }} />
            <span className={cn("text-body min-w-0 flex-1 truncate", lg ? "text-[13.5px]" : "text-[12.5px]")}>
              {r.name}
            </span>
            <span className={cn("text-secondary-ink shrink-0 font-semibold tabular-nums", lg ? "text-[13px]" : "text-[12px]")}>
              {formatDuration(r.ms)}
            </span>
          </li>
        ))}
        {more > 0 && <li className="text-caption pl-4 text-[11.5px]">+{more} more</li>}
      </ul>
    </div>
  );
}
