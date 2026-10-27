import { SectionHeader } from "progra";

// The 10px uppercase eyebrow that opens every section. On a tab it is also
// the screen's ONLY title — there are no big headlines on tabs.
export function Plain() {
  return (
    <div className="w-full px-5" style={{ maxWidth: 390 }}>
      <SectionHeader label="Today" />
    </div>
  );
}

export function WithMetaAndLink() {
  return (
    <div className="w-full px-5" style={{ maxWidth: 390 }}>
      <SectionHeader label="Habits" meta="3 of 4 today" href="/habits" />
    </div>
  );
}

// In context: hairline rule, then the header, then hairline-divided rows.
export function InSection() {
  const rows = [
    { title: "Thesis — lit review", sub: "Thesis · 9:40 AM", color: "#395AA0", h: "1h 50m" },
    { title: "Spanish flashcards", sub: "Spanish · 1:15 PM", color: "#E07042", h: "35m" },
    { title: "Problem set 4", sub: "CSE 332 · 3:00 PM", color: "#2E8B50", h: "1h 20m" },
  ];
  return (
    <div className="w-full px-5" style={{ maxWidth: 390 }}>
      <div aria-hidden className="bg-hairline h-px w-full" />
      <section className="flex flex-col pt-3">
        <SectionHeader label="Today" meta="3 sessions · 3h 45m" className="pb-2" />
        {rows.map((r) => (
          <div key={r.title} className="border-divider flex items-center gap-2.5 border-t py-[7px]">
            <span className="h-5 w-[3px] shrink-0 rounded-[2px]" style={{ backgroundColor: r.color }} />
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="text-body truncate text-[13px] leading-[1.25] font-semibold">{r.title}</span>
              <span className="text-faint truncate text-[11px] leading-[1.3]">{r.sub}</span>
            </div>
            <span className="text-body shrink-0 text-[13px] font-semibold tabular-nums">{r.h}</span>
          </div>
        ))}
      </section>
    </div>
  );
}
