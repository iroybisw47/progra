import Link from "next/link";
import { ChevronRightIcon } from "lucide-react";

import {
  GROUP_COPY,
  GROUPS_TAB_COPY,
  isGroupFull,
  memberCountLine,
  type GroupSummary,
} from "@/lib/groups";
import { cn } from "@/lib/utils";

// The v3 Friends tab's Groups sub-tab (GROUPS): your groups with their member
// counts, then every group you could join, full ones greyed out, each row
// opening its page (app/groups/[id]), where Join and Leave live. Read-only:
// it lists and links, so it needs none of the tab's write machinery.
export function GroupsTab({ groups }: { groups: readonly GroupSummary[] }) {
  const mine = groups.filter((g) => g.isMember);
  const browse = groups.filter((g) => !g.isMember);
  return (
    <>
      <GroupSection label={GROUPS_TAB_COPY.yours} meta={mine.length > 0 ? String(mine.length) : undefined}>
        {mine.length === 0 ? (
          <Note>{GROUPS_TAB_COPY.noneYet}</Note>
        ) : (
          <ul role="list">
            {mine.map((g) => (
              <GroupRow key={g.groupId} group={g} />
            ))}
          </ul>
        )}
      </GroupSection>
      <GroupSection label={GROUPS_TAB_COPY.browse}>
        {browse.length === 0 ? (
          <Note>{GROUPS_TAB_COPY.noneToJoin}</Note>
        ) : (
          <ul role="list">
            {browse.map((g) => (
              <GroupRow key={g.groupId} group={g} />
            ))}
          </ul>
        )}
      </GroupSection>
    </>
  );
}

function GroupRow({ group }: { group: GroupSummary }) {
  const full = !group.isMember && isGroupFull(group);
  return (
    <li>
      <Link
        href={`/groups/${group.groupId}`}
        className={cn("border-divider flex items-center gap-[11px] border-t px-5 py-[11px]", full && "opacity-50")}
      >
        <span
          aria-hidden
          className="bg-track text-body flex size-9 shrink-0 items-center justify-center rounded-[11px] font-serif text-[15px] font-semibold"
        >
          {group.name.trim().charAt(0).toUpperCase()}
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-px">
          <span className="text-body truncate text-[13px] leading-[1.25] font-semibold">{group.name}</span>
          <span className="text-faint truncate text-[11px] leading-[1.3] tabular-nums">
            {memberCountLine(group)}
            {!group.autoFriend && ` · ${GROUP_COPY.open}`}
            {full && ` · ${GROUP_COPY.full}`}
          </span>
        </span>
        <ChevronRightIcon aria-hidden className="text-faint size-4 shrink-0" strokeWidth={2} />
      </Link>
    </li>
  );
}

// Headed like the Friends sub-tab's sections: the eyebrow and a count.
function GroupSection({ label, meta, children }: { label: string; meta?: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col">
      <div className="flex items-center gap-[7px] px-5 pt-4 pb-2">
        <h2 className="section-label font-sans">{label}</h2>
        <span className="flex-1" />
        {meta && (
          <span className="text-caption text-[10px] font-semibold tracking-[0.06em] tabular-nums">{meta}</span>
        )}
      </div>
      {children}
    </section>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return <p className="text-caption border-divider border-t px-5 py-3 text-[13px] text-pretty">{children}</p>;
}
